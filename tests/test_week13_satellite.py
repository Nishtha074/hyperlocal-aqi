"""
Unit Tests for Week 13 Sentinel-5P NO2 Satellite Data Processing.
"""

import os
import pytest
import numpy as np
import pandas as pd
from src.spatial.satellite_processor import Sentinel5PNO2Processor, MUMBAI_BBOX, haversine_distance_km


def test_haversine_distance_km():
    # Distance between Colaba (18.91, 72.82) and Worli (18.9936, 72.8128) is ~9.3 km
    dist = haversine_distance_km(18.91, 72.82, 18.9936, 72.8128)
    assert np.isclose(dist, 9.3, atol=0.5)


def test_sentinel5p_processor_generation_and_clipping():
    processor = Sentinel5PNO2Processor(bbox=MUMBAI_BBOX)
    df_raw = processor.generate_sentinel5p_no2_dataset(
        start_date="2020-01-01",
        end_date="2020-01-05",
        grid_resolution_deg=0.05,
        random_seed=42
    )

    assert len(df_raw) > 0
    assert "no2_satellite" in df_raw.columns
    assert "latitude" in df_raw.columns
    assert "longitude" in df_raw.columns
    assert "date" in df_raw.columns

    df_clipped = processor.clip_to_mumbai(df_raw)
    assert df_clipped["latitude"].min() >= MUMBAI_BBOX["min_lat"]
    assert df_clipped["latitude"].max() <= MUMBAI_BBOX["max_lat"]
    assert df_clipped["longitude"].min() >= MUMBAI_BBOX["min_lon"]
    assert df_clipped["longitude"].max() <= MUMBAI_BBOX["max_lon"]


def test_sentinel5p_processor_cleaning_and_summary():
    processor = Sentinel5PNO2Processor(bbox=MUMBAI_BBOX)

    # Create dummy dataframe with invalid and fill values
    df_dirty = pd.DataFrame({
        "date": ["2020-01-01", "2020-01-01", "2020-01-02", "2020-01-02"],
        "latitude": [19.0, 19.1, 19.0, 19.1],
        "longitude": [72.8, 72.9, 72.8, 72.9],
        "no2_satellite": [50.0, -9999.0, -10.0, np.nan]
    })

    df_clean = processor.clean_satellite_data(df_dirty)

    # All invalid/fill values should be handled and imputed
    assert df_clean["no2_satellite"].isna().sum() == 0
    assert (df_clean["no2_satellite"] >= 0).all()

    summary = processor.get_summary_statistics(df_dirty, df_clean)
    assert summary["num_rows"] == 4
    assert summary["min_no2"] > 0
