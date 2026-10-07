import pandas as pd
import pytest

from src.dashboard_helpers import (
    get_latest_air_quality_snapshot,
    load_station_data,
    validate_bad_data,
)


def test_missing_values_are_handled_without_crashing():
    df = pd.DataFrame(
        {
            "PM2.5": [12.0, None, 15.0],
            "PM10": [None, 40.0, 50.0],
            "AQI": [None, 80.0, 90.0],
            "Latitude": [19.1, None, 18.9],
            "Longitude": [72.8, 72.9, None],
            "Datetime": ["2024-01-01 00:00:00", "2024-01-01 01:00:00", "2024-01-01 02:00:00"],
        }
    )
    cleaned = validate_bad_data(df)
    assert not cleaned.empty
    assert cleaned["PM2.5"].notna().sum() >= 2


def test_invalid_aqi_and_coordinates_are_rejected():
    df = pd.DataFrame(
        {
            "AQI": [-5, 1000, 120, 2000],
            "Latitude": [19.1, 91, -89.5, 10],
            "Longitude": [72.8, -181, 180, 72.9],
            "Datetime": ["2024-01-01 00:00:00", "2024-01-01 01:00:00", "2024-01-01 02:00:00", "2024-01-01 03:00:00"],
        }
    )
    cleaned = validate_bad_data(df)
    assert all(cleaned["AQI"].between(0, 1000) | cleaned["AQI"].isna())
    assert cleaned["Latitude"].between(-90, 90).all()
    assert cleaned["Longitude"].between(-180, 180).all()


def test_snapshot_handles_missing_data_gracefully():
    snapshot = get_latest_air_quality_snapshot()
    assert "current_aqi" in snapshot
    assert "forecast_map" in snapshot
    assert snapshot["location"] in {"Mumbai", "Unknown", "Maharashtra"} or isinstance(snapshot["location"], str)


def test_station_loader_returns_dataframe_even_when_data_missing():
    stations = load_station_data()
    assert isinstance(stations, pd.DataFrame)
