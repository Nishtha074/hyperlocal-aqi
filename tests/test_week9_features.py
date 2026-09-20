import pytest
import pandas as pd
import numpy as np
from src.forecasting.feature_engineering import (
    TimeSeriesFeatureEngineer,
    validate_engineered_features,
    haversine_distance,
)


def test_haversine_distance():
    # Distance between Mumbai Airport T2 (19.1008, 72.8746) and Kurla (19.0863, 72.8888) is ~2.2 km
    dist = haversine_distance(19.1008, 72.8746, 19.0863, 72.8888)
    assert np.isclose(dist, 2.1968, atol=0.1)


def test_feature_engineer_pipeline():
    # Construct dummy multi-station hourly dataframe
    dates = pd.date_range(start="2023-01-01 00:00:00", periods=30, freq="1h")
    data_st1 = pd.DataFrame({
        "StationId": "S1",
        "Datetime": dates,
        "PM2.5": np.linspace(10, 40, 30),
        "Temperature": 30.0,
        "Humidity": 60.0,
        "WindSpeed": 10.0,
        "Rainfall": 0.0,
        "Latitude": 19.10,
        "Longitude": 72.87,
    })
    data_st2 = pd.DataFrame({
        "StationId": "S2",
        "Datetime": dates,
        "PM2.5": np.linspace(20, 50, 30),
        "Temperature": 31.0,
        "Humidity": 62.0,
        "WindSpeed": 12.0,
        "Rainfall": 0.0,
        "Latitude": 19.11,
        "Longitude": 72.88,
    })
    df_raw = pd.concat([data_st1, data_st2], ignore_index=True)

    engineer = TimeSeriesFeatureEngineer(nearby_radius_km=10.0)
    df_eng = engineer.run_all(df_raw)

    # Check lag features present
    assert "PM25_lag_1" in df_eng.columns
    assert "PM25_lag_24" in df_eng.columns

    # Check time encodings
    assert "sin_hour" in df_eng.columns
    assert "cos_hour" in df_eng.columns
    assert "sin_month" in df_eng.columns
    assert "cos_month" in df_eng.columns

    # Check spatial feature
    assert "nearby_station_PM25" in df_eng.columns

    # Check target features
    assert "target_PM25_1h" in df_eng.columns

    # Run validation suite
    val_res = validate_engineered_features(df_eng)
    assert val_res["lag_1_alignment_correct"] is True
    assert val_res["no_future_data_leakage"] is True
    assert val_res["all_required_columns_present"] is True
