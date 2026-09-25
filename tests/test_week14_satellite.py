"""
Unit & Integration Tests for Week 14 Satellite Integration and XGBoost Modeling.
"""

import os
import pytest
import numpy as np
import pandas as pd
from src.data.satellite_integration import SatelliteGroundIntegrator
from src.forecasting.xgboost_satellite import XGBoostSatellitePipeline


def test_satellite_ground_integrator_merge(tmp_path):
    # Construct dummy ground data
    ground_df = pd.DataFrame({
        "StationId": ["S1", "S1", "S2", "S2"],
        "Datetime": ["2020-01-01 00:00:00", "2020-01-01 01:00:00", "2020-01-01 00:00:00", "2020-01-01 01:00:00"],
        "Latitude": [19.10, 19.10, 18.91, 18.91],
        "Longitude": [72.87, 72.87, 72.82, 72.82],
        "PM2.5": [30.0, 32.0, 45.0, 48.0],
        "target_PM25_1h": [32.0, 35.0, 48.0, 50.0]
    })
    ground_file = tmp_path / "ground.csv"
    ground_df.to_csv(ground_file, index=False)

    # Construct dummy satellite data
    sat_df = pd.DataFrame({
        "date": ["2020-01-01", "2020-01-01"],
        "latitude": [19.10, 18.91],
        "longitude": [72.87, 72.82],
        "no2_satellite": [80.5, 95.2]
    })
    sat_file = tmp_path / "sat.csv"
    sat_df.to_csv(sat_file, index=False)

    integrator = SatelliteGroundIntegrator(
        ground_data_path=str(ground_file),
        satellite_data_path=str(sat_file)
    )
    merged_df = integrator.merge_datasets()

    assert "no2_satellite" in merged_df.columns
    assert len(merged_df) == 4
    assert merged_df["no2_satellite"].isna().sum() == 0


def test_xgboost_satellite_pipeline(tmp_path):
    # Construct dummy dataset with satellite feature
    dates = pd.date_range(start="2020-01-01", periods=100, freq="1h")
    df = pd.DataFrame({
        "Datetime": dates,
        "StationId": "MH007",
        "PM2.5": np.random.uniform(10, 50, 100),
        "PM25_lag_1": np.random.uniform(10, 50, 100),
        "PM25_lag_24": np.random.uniform(10, 50, 100),
        "Temperature": np.random.uniform(25, 35, 100),
        "Humidity": np.random.uniform(50, 80, 100),
        "WindSpeed": np.random.uniform(2, 15, 100),
        "Rainfall": 0.0,
        "sin_hour": np.sin(2 * np.pi * dates.hour / 24.0),
        "cos_hour": np.cos(2 * np.pi * dates.hour / 24.0),
        "Latitude": 19.10,
        "Longitude": 72.87,
        "nearby_station_PM25": np.random.uniform(10, 50, 100),
        "no2_satellite": np.random.uniform(40, 120, 100),
        "target_PM25_1h": np.random.uniform(10, 50, 100)
    })
    data_file = tmp_path / "model_features.csv"
    df.to_csv(data_file, index=False)

    pipeline = XGBoostSatellitePipeline(data_path=str(data_file))
    pipeline.load_and_prepare_data(train_ratio=0.8)

    m_base = pipeline.train_baseline_xgboost()
    m_sat = pipeline.train_satellite_xgboost()

    assert "MAE" in m_base
    assert "RMSE" in m_sat
    assert "R2" in m_sat

    rank_info = pipeline.get_satellite_feature_rank()
    assert "rank" in rank_info
    assert "no2_satellite" in rank_info["top_10_features"] or rank_info["rank"] <= len(pipeline.X_train_sat.columns)
