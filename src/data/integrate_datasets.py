import os
import time
import requests
import pandas as pd
from typing import Dict, Tuple

# Defaults matching Week 3 preprocessing output and Week 4 integration objectives
DEFAULT_AQ_INPUT = os.path.join("data", "processed", "clean_air_quality.csv")
DEFAULT_MASTER_OUTPUT = os.path.join("data", "processed", "master_pollution_weather.csv")

# Mumbai center coordinates used in original data analysis
MUMBAI_LAT = 19.0760
MUMBAI_LON = 72.8777


def fetch_historical_weather(
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    retries: int = 3,
    backoff_factor: float = 1.0
) -> pd.DataFrame:
    """
    Fetches hourly meteorological variables from the Open-Meteo Archive API.
    
    Args:
        lat: Latitude of the target location.
        lon: Longitude of the target location.
        start_date: Start date string formatted as YYYY-MM-DD.
        end_date: End date string formatted as YYYY-MM-DD.
        retries: Number of request retries on failure.
        backoff_factor: Multiplier for exponential backoff sleep time.
        
    Returns:
        pd.DataFrame: Weather dataframe with standard column naming.
    """
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "surface_pressure",
            "wind_speed_10m",
            "wind_direction_10m",
            "cloud_cover"
        ],
        "timezone": "Asia/Kolkata"
    }

    # API columns translation map
    rename_cols = {
        "time": "Datetime",
        "temperature_2m": "Temperature",
        "relative_humidity_2m": "Humidity",
        "precipitation": "Rainfall",
        "surface_pressure": "Pressure",
        "wind_speed_10m": "WindSpeed",
        "wind_direction_10m": "WindDirection",
        "cloud_cover": "CloudCover"
    }

    for attempt in range(retries):
        try:
            print(f"Requesting weather from {start_date} to {end_date} (attempt {attempt + 1}/{retries})...")
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            if "hourly" not in data:
                raise ValueError("Response does not contain hourly weather metrics.")
            
            weather_df = pd.DataFrame(data["hourly"])
            # Rename columns
            weather_df = weather_df.rename(columns=rename_cols)
            
            # Cast Datetime and ensure it is timezone-naive
            weather_df["Datetime"] = pd.to_datetime(weather_df["Datetime"]).dt.tz_localize(None)
            
            # Reorder columns to put Datetime first
            cols = ["Datetime"] + [col for col in weather_df.columns if col != "Datetime"]
            weather_df = weather_df[cols]
            
            return weather_df
            
        except (requests.exceptions.RequestException, ValueError) as err:
            print(f"Weather fetch failed: {err}")
            if attempt < retries - 1:
                sleep_time = backoff_factor * (2 ** attempt)
                print(f"Sleeping for {sleep_time} seconds before retrying...")
                time.sleep(sleep_time)
            else:
                raise ConnectionError(f"Failed to retrieve weather data after {retries} attempts.") from err


def merge_datasets(aq_df: pd.DataFrame, weather_df: pd.DataFrame) -> pd.DataFrame:
    """
    Spatio-temporally merges cleaned air quality and weather data on the Datetime key.
    
    Args:
        aq_df: Air quality dataset.
        weather_df: Meteorological dataset.
        
    Returns:
        pd.DataFrame: Sorted merged dataset.
    """
    aq_df = aq_df.copy()
    weather_df = weather_df.copy()

    # Ensure Datetime formatting consistency
    aq_df["Datetime"] = pd.to_datetime(aq_df["Datetime"]).dt.tz_localize(None)
    weather_df["Datetime"] = pd.to_datetime(weather_df["Datetime"]).dt.tz_localize(None)

    # Sort data for merge consistency
    aq_df = aq_df.sort_values(["StationId", "Datetime"])
    weather_df = weather_df.sort_values("Datetime")

    # Left merge to preserve all air quality records
    merged_df = pd.merge(aq_df, weather_df, on="Datetime", how="left")
    
    return merged_df


def generate_forecast_targets(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generates forecasting targets (1h, 3h, 6h ahead values of PM2.5) grouped by StationId.
    
    Args:
        df: Merged air quality and meteorological dataset.
        
    Returns:
        pd.DataFrame: Dataset with target_1h, target_3h, and target_6h columns added.
    """
    df = df.copy().sort_values(["StationId", "Datetime"])
    
    # Negative shift values reflect variables in the future
    df["target_1h"] = df.groupby("StationId")["PM2.5"].shift(-1)
    df["target_3h"] = df.groupby("StationId")["PM2.5"].shift(-3)
    df["target_6h"] = df.groupby("StationId")["PM2.5"].shift(-6)
    
    return df


def run_integration_pipeline(
    aq_input_path: str = None,
    master_output_path: str = None,
    lat: float = MUMBAI_LAT,
    lon: float = MUMBAI_LON
) -> Tuple[pd.DataFrame, Dict]:
    """
    Orchestrates the entire dataset integration pipeline.
    
    Args:
        aq_input_path: Path to cleaned air quality data.
        master_output_path: Target path for the merged dataset output.
        lat: Latitude for weather fetch.
        lon: Longitude for weather fetch.
        
    Returns:
        Tuple[pd.DataFrame, Dict]: Merged master dataframe and execution quality metrics.
    """
    aq_input_path = aq_input_path or DEFAULT_AQ_INPUT
    master_output_path = master_output_path or DEFAULT_MASTER_OUTPUT

    if not os.path.exists(aq_input_path):
        raise FileNotFoundError(f"Cleaned air quality file not found at {aq_input_path}")

    print(f"Loading cleaned air quality dataset from {aq_input_path}...")
    aq_df = pd.read_csv(aq_input_path)
    
    # Detect date ranges dynamically
    aq_times = pd.to_datetime(aq_df["Datetime"])
    start_date = aq_times.min().strftime("%Y-%m-%d")
    end_date = aq_times.max().strftime("%Y-%m-%d")

    # Fetch weather data
    weather_df = fetch_historical_weather(lat, lon, start_date, end_date)
    
    # Integrate weather and air quality variables
    print("Merging air quality and meteorological datasets...")
    integrated_df = merge_datasets(aq_df, weather_df)
    
    # Generate predictive target columns
    print("Computing target forecast columns (target_1h, target_3h, target_6h)...")
    integrated_df = generate_forecast_targets(integrated_df)

    # Save output
    os.makedirs(os.path.dirname(master_output_path), exist_ok=True)
    integrated_df.to_csv(master_output_path, index=False)
    print(f"Successfully exported master dataset to {master_output_path}")

    # Generate pipeline validation report metrics
    report = {
        "final_shape": integrated_df.shape,
        "input_air_quality_rows": len(aq_df),
        "fetched_weather_rows": len(weather_df),
        "target_1h_nans": int(integrated_df["target_1h"].isna().sum()),
        "target_3h_nans": int(integrated_df["target_3h"].isna().sum()),
        "target_6h_nans": int(integrated_df["target_6h"].isna().sum()),
        "missing_weather_temp": int(integrated_df["Temperature"].isna().sum())
    }
    
    print("\n--- Pipeline Quality Report ---")
    print(f"Integrated Dataset Shape: {report['final_shape']}")
    print(f"Target 1h NaN Value Count: {report['target_1h_nans']}")
    print(f"Target 3h NaN Value Count: {report['target_3h_nans']}")
    print(f"Target 6h NaN Value Count: {report['target_6h_nans']}")
    print(f"Missing Weather Matches Count: {report['missing_weather_temp']}")
    print("--------------------------------\n")

    return integrated_df, report


if __name__ == "__main__":
    run_integration_pipeline()
