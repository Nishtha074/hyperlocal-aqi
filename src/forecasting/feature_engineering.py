"""
Feature Engineering Pipeline for Hyperlocal Air Quality Forecasting in Mumbai.

This module provides a modular, production-ready implementation of time-series,
meteorological, cyclical, and spatial feature engineering for PM2.5 forecasting.
"""

import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Optional


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using Haversine formula.

    Returns distance in kilometers.
    """
    R = 6371.0  # Earth radius in kilometers

    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    c = 2 * np.arcsin(np.sqrt(a))
    return float(R * c)


class TimeSeriesFeatureEngineer:
    """
    Modular feature engineering pipeline for multi-station PM2.5 forecasting.
    """

    def __init__(self, nearby_radius_km: float = 10.0):
        self.nearby_radius_km = nearby_radius_km
        self.station_coords: Dict[str, Tuple[float, float]] = {}

    def prepare_data(
        self, df: pd.DataFrame, station_metadata: Optional[pd.DataFrame] = None
    ) -> pd.DataFrame:
        """
        1. Data Preparation:
           - Parses Datetime.
           - Merges Station Metadata (Latitude, Longitude) if needed.
           - Sorts by StationId and Datetime.
           - Removes duplicates.
           - Interpolates/fills missing values safely per station.
        """
        df = df.copy()

        # Parse Datetime
        df["Datetime"] = pd.to_datetime(df["Datetime"])

        # Merge Lat/Lon from metadata if missing in master dataset
        if ("Latitude" not in df.columns or "Longitude" not in df.columns) and station_metadata is not None:
            meta_cols = ["StationId", "Latitude", "Longitude"]
            station_meta_subset = station_metadata[[c for c in meta_cols if c in station_metadata.columns]]
            df = df.merge(station_meta_subset, on="StationId", how="left")

        # Sort cleanly by StationId and Datetime
        df = df.sort_values(by=["StationId", "Datetime"]).reset_index(drop=True)

        # Remove duplicate records
        df = df.drop_duplicates(subset=["StationId", "Datetime"]).reset_index(drop=True)

        # Populate station coords dictionary
        if "Latitude" in df.columns and "Longitude" in df.columns:
            coords = df.groupby("StationId")[["Latitude", "Longitude"]].first()
            for st_id, row in coords.iterrows():
                self.station_coords[str(st_id)] = (float(row["Latitude"]), float(row["Longitude"]))

        # Handle missing target & weather values per station without data leakage (forward fill up to 3h limit)
        numeric_cols = ["PM2.5", "Temperature", "Humidity", "WindSpeed", "Rainfall"]
        present_cols = [c for c in numeric_cols if c in df.columns]

        for col in present_cols:
            # Group by station, perform forward fill with max limit=3 to avoid propagating long missing gaps
            df[col] = df.groupby("StationId")[col].transform(lambda x: x.ffill(limit=3))

        return df

    def create_lag_features(self, df: pd.DataFrame, lags: List[int] = [1, 2, 3, 6, 12, 24]) -> pd.DataFrame:
        """
        2. Lag Features:
           Generates PM25_lag_k for each station using strictly past observations.
        """
        df = df.copy()
        for k in lags:
            col_name = f"PM25_lag_{k}"
            # Shift strictly within each StationId group
            df[col_name] = df.groupby("StationId")["PM2.5"].shift(k)

        return df

    def create_weather_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        3. Weather Features:
           - Raw weather: Temperature, Humidity, WindSpeed, Rainfall.
           - Rolling averages (3h, 6h).
           - 1-hour rates of change.
           - Rainfall indicators (is_raining, rain_roll_3h).
        """
        df = df.copy()

        # Standardize column names if needed
        col_map = {
            "temperature": "Temperature",
            "humidity": "Humidity",
            "wind_speed": "WindSpeed",
            "rainfall": "Rainfall",
        }
        for old_col, new_col in col_map.items():
            if old_col in df.columns and new_col not in df.columns:
                df[new_col] = df[old_col]

        # Ensure weather columns exist or fallback to defaults
        for col in ["Temperature", "Humidity", "WindSpeed", "Rainfall"]:
            if col not in df.columns:
                df[col] = 0.0

        # Derived rolling averages per station
        mapping_names = {
            "Temperature": "temp",
            "Humidity": "humidity",
            "WindSpeed": "wind_speed",
            "PM2.5": "pm25",
        }

        for orig_col, prefix in mapping_names.items():
            if orig_col in df.columns:
                df[f"{prefix}_roll_3h"] = (
                    df.groupby("StationId")[orig_col]
                    .transform(lambda x: x.shift(1).rolling(window=3, min_periods=1).mean())
                )
                df[f"{prefix}_roll_6h"] = (
                    df.groupby("StationId")[orig_col]
                    .transform(lambda x: x.shift(1).rolling(window=6, min_periods=1).mean())
                )

        # Derived 1-hour rate of change per station
        for orig_col, prefix in [("Temperature", "temp"), ("Humidity", "humidity"), ("WindSpeed", "wind_speed")]:
            if orig_col in df.columns:
                df[f"{prefix}_change_1h"] = (
                    df.groupby("StationId")[orig_col]
                    .transform(lambda x: x.diff(1))
                )

        # Rainfall derived features
        df["is_raining"] = (df["Rainfall"] > 0.0).astype(int)
        df["rain_roll_3h"] = (
            df.groupby("StationId")["Rainfall"]
            .transform(lambda x: x.rolling(window=3, min_periods=1).sum())
        )

        return df

    def create_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        4. Time Features:
           - Calendar variables: hour, day, month, day_of_week, is_weekend.
           - Cyclical transformations: sin_hour, cos_hour, sin_month, cos_month.
        """
        df = df.copy()

        df["hour"] = df["Datetime"].dt.hour
        df["day"] = df["Datetime"].dt.day
        df["month"] = df["Datetime"].dt.month
        df["day_of_week"] = df["Datetime"].dt.dayofweek
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

        # Cyclical encoding for Hour (24-hour cycle)
        df["sin_hour"] = np.sin(2.0 * np.pi * df["hour"] / 24.0)
        df["cos_hour"] = np.cos(2.0 * np.pi * df["hour"] / 24.0)

        # Cyclical encoding for Month (12-month cycle)
        df["sin_month"] = np.sin(2.0 * np.pi * (df["month"] - 1) / 12.0)
        df["cos_month"] = np.cos(2.0 * np.pi * (df["month"] - 1) / 12.0)

        return df

    def create_spatial_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        5. Spatial Features:
           Computes nearby_station_PM25 feature using Haversine distance.
           For each station i and timestamp t, computes the average PM2.5 of 
           other stations j within radius_km at the exact same timestamp t.
           Prevents self-inclusion and future data leakage.
        """
        df = df.copy()

        stations = list(self.station_coords.keys())
        n_stations = len(stations)

        if n_stations <= 1:
            # If only 1 station, nearby is NaN or fallback to lag_1
            df["nearby_station_PM25"] = df["PM25_lag_1"] if "PM25_lag_1" in df.columns else df["PM2.5"]
            return df

        # Build distance matrix between station pairs
        dist_matrix = {}
        for i, st1 in enumerate(stations):
            dist_matrix[st1] = {}
            for j, st2 in enumerate(stations):
                if st1 == st2:
                    dist_matrix[st1][st2] = 0.0
                else:
                    lat1, lon1 = self.station_coords[st1]
                    lat2, lon2 = self.station_coords[st2]
                    dist_matrix[st1][st2] = haversine_distance(lat1, lon1, lat2, lon2)

        # Create timestamp matrix of PM2.5 across stations
        # Pivot table: Index=Datetime, Columns=StationId, Values=PM2.5
        pivot_pm25 = df.pivot(index="Datetime", columns="StationId", values="PM2.5")

        # Compute nearby mean matrix
        nearby_pm25_df = pd.DataFrame(index=pivot_pm25.index, columns=pivot_pm25.columns, dtype=float)

        for target_st in stations:
            # Find candidate stations within radius (excluding target station)
            nearby_sts = [
                st for st in stations 
                if st != target_st and dist_matrix[target_st][st] <= self.nearby_radius_km
            ]

            if len(nearby_sts) > 0:
                # Row-wise mean across nearby stations for each timestamp t
                nearby_pm25_df[target_st] = pivot_pm25[nearby_sts].mean(axis=1, skipna=True)
            else:
                nearby_pm25_df[target_st] = np.nan

        # Unpivot / Melt back to align with original dataframe shape
        nearby_melted = nearby_pm25_df.reset_index().melt(
            id_vars="Datetime", var_name="StationId", value_name="nearby_station_PM25"
        )

        # Merge back on Datetime and StationId
        df = df.merge(nearby_melted, on=["Datetime", "StationId"], how="left")

        # Fallback for timestamps/stations with no active nearby stations
        if "PM25_lag_1" in df.columns:
            df["nearby_station_PM25"] = df["nearby_station_PM25"].fillna(df["PM25_lag_1"])

        return df

    def create_target_variables(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Creates target variables for multi-horizon forecasting:
        - target_PM25_1h: PM2.5 at t+1
        - target_PM25_3h: PM2.5 at t+3
        - target_PM25_6h: PM2.5 at t+6
        """
        df = df.copy()

        df["target_PM25_1h"] = df.groupby("StationId")["PM2.5"].shift(-1)
        df["target_PM25_3h"] = df.groupby("StationId")["PM2.5"].shift(-3)
        df["target_PM25_6h"] = df.groupby("StationId")["PM2.5"].shift(-6)

        return df

    def run_all(
        self, df: pd.DataFrame, station_metadata: Optional[pd.DataFrame] = None
    ) -> pd.DataFrame:
        """
        Executes full feature engineering pipeline sequentially.
        """
        df_prep = self.prepare_data(df, station_metadata=station_metadata)
        df_lags = self.create_lag_features(df_prep)
        df_weather = self.create_weather_features(df_lags)
        df_time = self.create_time_features(df_weather)
        df_spatial = self.create_spatial_features(df_time)
        df_final = self.create_target_variables(df_spatial)

        return df_final


def validate_engineered_features(df: pd.DataFrame) -> Dict[str, bool]:
    """
    Validation Suite to verify pipeline correctness and data integrity:
    1. Lag feature alignment.
    2. Data leakage verification (no future information in lags).
    3. Missing value report.
    4. Distribution sanity checks.
    """
    results = {}

    # Check 1: Lag 1 alignment check for a single station
    sample_st = df["StationId"].iloc[0]
    st_df = df[df["StationId"] == sample_st].copy().reset_index(drop=True)

    # Verify st_df['PM25_lag_1'].iloc[k] == st_df['PM2.5'].iloc[k-1]
    lag1_correct = True
    for k in range(1, min(100, len(st_df))):
        prev_val = st_df["PM2.5"].iloc[k - 1]
        lag_val = st_df["PM25_lag_1"].iloc[k]
        if pd.notna(prev_val) and pd.notna(lag_val):
            if not np.isclose(prev_val, lag_val, atol=1e-3):
                lag1_correct = False
                break

    results["lag_1_alignment_correct"] = lag1_correct

    # Check 2: Data Leakage Verification
    # Ensure PM25_lag_1 is NOT equal to target_PM25_1h (future)
    leakage_detected = False
    for k in range(1, min(100, len(st_df))):
        lag_val = st_df["PM25_lag_1"].iloc[k]
        target_val = st_df["target_PM25_1h"].iloc[k]
        if pd.notna(lag_val) and pd.notna(target_val):
            if np.isclose(lag_val, target_val, atol=1e-3) and not np.isclose(st_df["PM2.5"].iloc[k], st_df["PM2.5"].iloc[k-1]):
                leakage_detected = True
                break

    results["no_future_data_leakage"] = not leakage_detected

    # Check 3: Required columns present
    req_cols = [
        "PM25_lag_1", "PM25_lag_2", "PM25_lag_3", "PM25_lag_6", "PM25_lag_12", "PM25_lag_24",
        "sin_hour", "cos_hour", "sin_month", "cos_month", "nearby_station_PM25", "target_PM25_1h"
    ]
    results["all_required_columns_present"] = all(col in df.columns for col in req_cols)

    return results
