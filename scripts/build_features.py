"""
Build Features Script for Hyperlocal PM2.5 Forecasting in Mumbai.

Reads master dataset, executes TimeSeriesFeatureEngineer pipeline, runs validation checks,
and saves data/processed/mumbai_feature_engineered.csv.
"""

import os
import sys
import pandas as pd
import numpy as np

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.forecasting.feature_engineering import (
    TimeSeriesFeatureEngineer,
    validate_engineered_features,
)


def main():
    print("=" * 70)
    print("WEEK 9: TIME-SERIES FEATURE ENGINEERING PIPELINE")
    print("=" * 70)

    # Input paths
    master_path = "data/processed/master_pollution_weather.csv"
    meta_path = "data/processed/spatial_station_features.csv"
    output_path = "data/processed/mumbai_feature_engineered.csv"

    if not os.path.exists(master_path):
        raise FileNotFoundError(f"Master dataset not found at {master_path}")

    print(f"Loading input dataset from: {master_path}")
    df_raw = pd.read_csv(master_path)
    print(f"   Raw Dataset Shape: {df_raw.shape[0]} rows, {df_raw.shape[1]} columns")

    meta_df = None
    if os.path.exists(meta_path):
        print(f"Loading station metadata from: {meta_path}")
        meta_df = pd.read_csv(meta_path)

    # Initialize Feature Engineer
    engineer = TimeSeriesFeatureEngineer(nearby_radius_km=10.0)

    print("\nExecuting Feature Engineering Pipeline...")
    df_engineered = engineer.run_all(df_raw, station_metadata=meta_df)

    print(f"   Engineered Dataset Shape (Before dropna): {df_engineered.shape[0]} rows, {df_engineered.shape[1]} columns")

    # Run Validation Checks
    print("\nRunning Validation & Integrity Checks...")
    val_results = validate_engineered_features(df_engineered)
    for check_name, status in val_results.items():
        symbol = "[PASS]" if status else "[FAIL]"
        print(f"   {symbol} Check '{check_name}': {status}")

    # Drop rows with NaNs in primary features & target for ML training readiness
    feature_cols = [
        "PM25_lag_1", "PM25_lag_2", "PM25_lag_3", "PM25_lag_6", "PM25_lag_12", "PM25_lag_24",
        "Temperature", "Humidity", "WindSpeed", "Rainfall",
        "temp_roll_3h", "humidity_roll_3h", "wind_speed_roll_3h", "pm25_roll_3h",
        "temp_change_1h", "humidity_change_1h", "wind_speed_change_1h",
        "is_raining", "rain_roll_3h",
        "hour", "day", "month", "day_of_week", "is_weekend",
        "sin_hour", "cos_hour", "sin_month", "cos_month",
        "nearby_station_PM25"
    ]
    target_col = "target_PM25_1h"

    # Save complete dataset (including targets)
    print(f"\nSaving final engineered dataset to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_engineered.to_csv(output_path, index=False)

    # Clean ML ready dataset summary
    ml_ready_df = df_engineered.dropna(subset=feature_cols + [target_col])
    print(f"   ML-Ready Dataset Shape (After dropping incomplete lag/target rows): {ml_ready_df.shape[0]} rows, {ml_ready_df.shape[1]} columns")

    # Display Sample Rows
    print("\nSAMPLE GENERATED FEATURES (First 5 ML-Ready Rows):")
    display_cols = [
        "StationId", "Datetime", "PM2.5", "PM25_lag_1", "PM25_lag_24",
        "pm25_roll_3h", "sin_hour", "cos_hour", "nearby_station_PM25", "target_PM25_1h"
    ]
    print(ml_ready_df[display_cols].head(5).to_string(index=False))

    # Feature Distribution Statistics
    print("\nFEATURE SUMMARY STATISTICS (Mean, Std, Min, Max):")
    stat_cols = [
        "PM2.5", "PM25_lag_1", "PM25_lag_24", "temp_change_1h",
        "humidity_change_1h", "sin_hour", "nearby_station_PM25", "target_PM25_1h"
    ]
    print(ml_ready_df[stat_cols].describe().T[["mean", "std", "min", "50%", "max"]].to_string())

    print("\nFeature Engineering Pipeline Completed Successfully!")


if __name__ == "__main__":
    main()
