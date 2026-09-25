"""
Spatio-Temporal Integration Module for Satellite + Ground Monitoring Data.

Combines ground CPCB air quality and weather features with Sentinel-5P NO2 satellite data
using date-based temporal alignment and nearest-neighbor spatial matching.
"""

import os
import logging
import numpy as np
import pandas as pd
from scipy.spatial import KDTree
from typing import Tuple, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points in kilometers."""
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2.0) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


class SatelliteGroundIntegrator:
    """
    Integrates Sentinel-5P Satellite NO2 measurements into CPCB Ground feature datasets.
    """

    def __init__(
        self,
        ground_data_path: str = "data/processed/mumbai_feature_engineered.csv",
        satellite_data_path: str = "data/processed/mumbai_satellite_no2.csv"
    ):
        self.ground_data_path = ground_data_path
        self.satellite_data_path = satellite_data_path
        self.ground_df: pd.DataFrame = None
        self.satellite_df: pd.DataFrame = None
        self.merged_df: pd.DataFrame = None

    def load_datasets(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Loads ground and satellite datasets."""
        if not os.path.exists(self.ground_data_path):
            raise FileNotFoundError(f"Ground dataset not found at {self.ground_data_path}")
        if not os.path.exists(self.satellite_data_path):
            raise FileNotFoundError(f"Satellite dataset not found at {self.satellite_data_path}")

        self.ground_df = pd.read_csv(self.ground_data_path)
        self.satellite_df = pd.read_csv(self.satellite_data_path)

        logger.info(f"Loaded ground dataset ({len(self.ground_df)} rows) and satellite dataset ({len(self.satellite_df)} rows).")
        return self.ground_df, self.satellite_df

    def merge_datasets(self) -> pd.DataFrame:
        """
        Executes date-level temporal alignment and nearest-neighbor spatial matching.

        Strategy:
        1. Extract 'date' (YYYY-MM-DD) from 'Datetime' column in ground dataset.
        2. Group satellite grid by date.
        3. For each date and station (lat, lon), find the nearest satellite grid point using KDTree.
        4. Join the corresponding 'no2_satellite' value to the ground dataframe.
        """
        if self.ground_df is None or self.satellite_df is None:
            self.load_datasets()

        df_ground = self.ground_df.copy()
        df_sat = self.satellite_df.copy()

        df_ground["Datetime"] = pd.to_datetime(df_ground["Datetime"])
        df_ground["date_key"] = df_ground["Datetime"].dt.strftime("%Y-%m-%d")
        df_sat["date_key"] = df_sat["date"].astype(str)

        # Map unique station locations to their nearest satellite grid point per date
        unique_stations = df_ground[["StationId", "Latitude", "Longitude"]].drop_duplicates().reset_index(drop=True)
        unique_dates = df_ground["date_key"].unique()

        station_sat_mappings = []

        logger.info(f"Performing spatial nearest-neighbor matching for {len(unique_stations)} stations across {len(unique_dates)} dates...")

        for date_key in unique_dates:
            sat_date_sub = df_sat[df_sat["date_key"] == date_key].reset_index(drop=True)

            if len(sat_date_sub) == 0:
                # Fallback if specific date is missing: use overall spatial nearest grid point
                sat_date_sub = df_sat.groupby(["latitude", "longitude"])["no2_satellite"].mean().reset_index()

            sat_coords = sat_date_sub[["latitude", "longitude"]].values
            tree = KDTree(sat_coords)

            for _, st in unique_stations.iterrows():
                st_id = st["StationId"]
                st_lat = st["Latitude"]
                st_lon = st["Longitude"]

                # Find nearest satellite point
                dist, idx = tree.query([st_lat, st_lon])
                matched_no2 = sat_date_sub.iloc[idx]["no2_satellite"]
                matched_sat_lat = sat_date_sub.iloc[idx]["latitude"]
                matched_sat_lon = sat_date_sub.iloc[idx]["longitude"]
                matched_dist_km = haversine_distance_km(st_lat, st_lon, matched_sat_lat, matched_sat_lon)

                station_sat_mappings.append({
                    "date_key": date_key,
                    "StationId": st_id,
                    "no2_satellite": matched_no2,
                    "sat_match_dist_km": round(matched_dist_km, 3)
                })

        mapping_df = pd.DataFrame(station_sat_mappings)

        # Merge matching table back into ground dataframe
        df_merged = pd.merge(df_ground, mapping_df, on=["date_key", "StationId"], how="left")

        # Clean transient date key
        df_merged.drop(columns=["date_key"], inplace=True)

        # Fill any residual missing no2_satellite values with column median
        if df_merged["no2_satellite"].isna().sum() > 0:
            median_val = df_merged["no2_satellite"].median()
            df_merged["no2_satellite"].fillna(median_val, inplace=True)

        self.merged_df = df_merged
        logger.info(f"Successfully integrated satellite NO2. Merged shape: {df_merged.shape}")
        logger.info(f"Average spatial matching distance to nearest satellite grid: {mapping_df['sat_match_dist_km'].mean():.2f} km")

        return df_merged

    def save_feature_dataset(self, output_path: str = "data/features/model_with_satellite.csv") -> None:
        """Saves the combined modeling dataset to data/features/."""
        if self.merged_df is None:
            self.merge_datasets()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        self.merged_df.to_csv(output_path, index=False)
        logger.info(f"Saved feature dataset with satellite NO2 to {output_path}")
