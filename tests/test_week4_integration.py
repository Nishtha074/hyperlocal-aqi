import os
import pytest
import pandas as pd
import importlib.util
import requests
from unittest.mock import patch, MagicMock

# Load module dynamically using established repo patterns
spec = importlib.util.spec_from_file_location(
    "integrate_datasets",
    os.path.join(os.path.dirname(__file__), "..", "src", "data", "integrate_datasets.py")
)
integrate_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrate_mod)
int_d = integrate_mod


@patch("requests.get")
def test_fetch_historical_weather_success(mock_get):
    # Set up mock response for Open-Meteo Archive API
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "hourly": {
            "time": ["2019-06-04T00:00", "2019-06-04T01:00"],
            "temperature_2m": [28.9, 28.7],
            "relative_humidity_2m": [78, 80],
            "precipitation": [0.0, 0.0],
            "surface_pressure": [1006.4, 1005.6],
            "wind_speed_10m": [11.2, 10.2],
            "wind_direction_10m": [249, 260],
            "cloud_cover": [22, 29]
        }
    }
    mock_get.return_value = mock_response

    weather_df = int_d.fetch_historical_weather(19.076, 72.877, "2019-06-04", "2019-06-04")
    
    # Assertions
    assert weather_df is not None
    assert len(weather_df) == 2
    assert "Temperature" in weather_df.columns
    assert "Datetime" in weather_df.columns
    assert weather_df.iloc[0]["Temperature"] == 28.9
    assert pd.api.types.is_datetime64_any_dtype(weather_df["Datetime"])
    assert weather_df["Datetime"].iloc[0] == pd.Timestamp("2019-06-04 00:00:00")


@patch("requests.get")
def test_fetch_historical_weather_retry_and_success(mock_get):
    # Setup mocks with error responses followed by a success
    mock_fail = MagicMock()
    mock_fail.raise_for_status.side_effect = requests.RequestException("API Error")
    
    mock_success = MagicMock()
    mock_success.status_code = 200
    mock_success.json.return_value = {
        "hourly": {
            "time": ["2019-06-04T00:00"],
            "temperature_2m": [28.9],
            "relative_humidity_2m": [78],
            "precipitation": [0.0],
            "surface_pressure": [1006.4],
            "wind_speed_10m": [11.2],
            "wind_direction_10m": [249],
            "cloud_cover": [22]
        }
    }
    # Fail twice, succeed on third attempt
    mock_get.side_effect = [mock_fail, mock_fail, mock_success]



    weather_df = int_d.fetch_historical_weather(19.076, 72.877, "2019-06-04", "2019-06-04", retries=3, backoff_factor=0.01)
    
    assert len(weather_df) == 1
    assert weather_df.iloc[0]["Temperature"] == 28.9
    assert mock_get.call_count == 3


def test_merge_datasets_alignment():
    # Make air quality sample
    aq_data = {
        "StationId": ["MH001", "MH001", "MH002", "MH002"],
        "Datetime": ["2019-06-04 00:00:00", "2019-06-04 01:00:00", "2019-06-04 00:00:00", "2019-06-04 01:00:00"],
        "PM2.5": [12.0, 15.0, 18.0, 22.0]
    }
    aq_df = pd.DataFrame(aq_data)
    
    # Make weather sample
    weather_data = {
        "Datetime": ["2019-06-04 00:00:00", "2019-06-04 01:00:00"],
        "Temperature": [28.5, 29.0]
    }
    weather_df = pd.DataFrame(weather_data)

    merged = int_d.merge_datasets(aq_df, weather_df)
    
    # Checks
    assert len(merged) == 4
    # All temperature rows should be matched
    assert merged.isna().sum().sum() == 0
    # MH001 at 00:00:00 should match 28.5
    assert merged[(merged["StationId"] == "MH001") & (merged["Datetime"] == "2019-06-04 00:00:00")]["Temperature"].iloc[0] == 28.5
    # MH002 at 01:00:00 should match 29.0
    assert merged[(merged["StationId"] == "MH002") & (merged["Datetime"] == "2019-06-04 01:00:00")]["Temperature"].iloc[0] == 29.0


def test_generate_forecast_targets():
    # Setup values with consecutive hours to test shifting
    data = {
        "StationId": ["MH001"] * 8 + ["MH002"] * 8,
        "Datetime": pd.date_range("2019-06-04 00:00:00", periods=8, freq="1h").tolist() * 2,
        "PM2.5": [float(i) for i in range(8)] + [float(i * 10) for i in range(8)]
    }
    df = pd.DataFrame(data)
    
    result = int_d.generate_forecast_targets(df)
    
    # Assert values
    # MH001 row index 0 has PM2.5 = 0.0. target_1h should be 1.0 (t+1), target_3h should be 3.0 (t+3), target_6h should be 6.0 (t+6)
    mh001_vals = result[result["StationId"] == "MH001"]
    assert mh001_vals.iloc[0]["target_1h"] == 1.0
    assert mh001_vals.iloc[0]["target_3h"] == 3.0
    assert mh001_vals.iloc[0]["target_6h"] == 6.0

    # MH002 row index 0 has PM2.5 = 0.0. target_1h should be 10.0 (t+1), target_3h should be 30.0 (t+3), target_6h should be 60.0 (t+6)
    mh002_vals = result[result["StationId"] == "MH002"]
    assert mh002_vals.iloc[0]["target_1h"] == 10.0
    assert mh002_vals.iloc[0]["target_3h"] == 30.0
    assert mh002_vals.iloc[0]["target_6h"] == 60.0

    # Boundary handling: last steps must have missing values due to shift limits
    # MH001 last element (index 7) should have NaN for 1h, 3h, and 6h targets
    assert pd.isna(mh001_vals.iloc[7]["target_1h"])
    assert pd.isna(mh001_vals.iloc[7]["target_3h"])
    assert pd.isna(mh001_vals.iloc[7]["target_6h"])
    
    # MH001 element at index 5 (t+2 remains) should have NaN for target_3h and target_6h, but target_1h should match 6.0
    assert mh001_vals.iloc[5]["target_1h"] == 6.0
    assert pd.isna(mh001_vals.iloc[5]["target_3h"])
    assert pd.isna(mh001_vals.iloc[5]["target_6h"])


@patch.object(int_d, "fetch_historical_weather")
def test_pipeline_execution(mock_fetch, tmp_path):
    # Setup mock air quality CSV in temp dir
    aq_path = tmp_path / "clean_air_quality.csv"
    output_path = tmp_path / "master_pollution_weather.csv"
    
    aq_data = {
        "StationId": ["MH001"] * 5,
        "Datetime": pd.date_range("2019-06-04 10:00:00", periods=5, freq="1h").strftime("%Y-%m-%d %H:%M:%S").tolist(),
        "PM2.5": [10.0, 12.0, 11.0, 14.0, 13.0]
    }
    pd.DataFrame(aq_data).to_csv(aq_path, index=False)

    # Mock weather returned from fetch
    weather_data = {
        "Datetime": pd.date_range("2019-06-04", periods=24, freq="1h").tolist(),
        "Temperature": [30.0] * 24,
        "Humidity": [60] * 24,
        "Rainfall": [0.0] * 24,
        "Pressure": [1008.0] * 24,
        "WindSpeed": [10.0] * 24,
        "WindDirection": [200] * 24,
        "CloudCover": [50] * 24
    }
    mock_fetch.return_value = pd.DataFrame(weather_data)

    integrated_df, report = int_d.run_integration_pipeline(
        aq_input_path=str(aq_path),
        master_output_path=str(output_path)
    )

    # Verification checks
    assert os.path.exists(output_path)
    assert integrated_df.shape == (5, 13)
    assert "target_1h" in integrated_df.columns
    assert "target_3h" in integrated_df.columns
    assert "target_6h" in integrated_df.columns
    assert "Temperature" in integrated_df.columns
    
    # 5 inputs, first 4 have target_1h, first 2 have target_3h, index 4 (last) has NaN for all
    assert report["target_1h_nans"] == 1
    assert report["target_3h_nans"] == 3
    assert report["target_6h_nans"] == 5
    assert report["missing_weather_temp"] == 0
