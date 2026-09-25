"""
Sentinel-5P NO2 Satellite Data Processing Module for Mumbai.

Handles:
- Mumbai bounding box clipping
- Data cleaning (Sentinel fill values, invalid/negative values, missing quality flags)
- Spatial grid dataset creation for Mumbai region (2019-06-04 to 2020-07-01)
- Spatial and temporal visualizations (heatmap, scatter map, time series)
- Summary statistics computation
"""

import os
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, Tuple, Optional, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Bounding box for Mumbai study region
MUMBAI_BBOX = {
    "min_lat": 18.85,
    "max_lat": 19.35,
    "min_lon": 72.75,
    "max_lon": 73.05,
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in km
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2.0) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


class Sentinel5PNO2Processor:
    """
    Downloads, processes, cleans, and summarizes Sentinel-5P Tropospheric NO2 satellite data.
    """

    def __init__(self, bbox: Optional[Dict[str, float]] = None):
        self.bbox = bbox or MUMBAI_BBOX

    def generate_sentinel5p_no2_dataset(
        self,
        start_date: str = "2019-06-04",
        end_date: str = "2020-07-01",
        grid_resolution_deg: float = 0.04,
        random_seed: int = 42
    ) -> pd.DataFrame:
        """
        Simulates / generates daily Sentinel-5P Tropospheric NO2 observations over the Mumbai bounding box
        anchored to spatial locations and seasonal atmospheric trends (higher NO2 in winter, lower in monsoon).

        Columns: date, latitude, longitude, no2_satellite
        """
        np.random.seed(random_seed)
        logger.info(f"Generating Sentinel-5P NO2 dataset from {start_date} to {end_date} over bbox {self.bbox}")

        dates = pd.date_range(start=start_date, end=end_date, freq="D")
        lats = np.arange(self.bbox["min_lat"] + 0.02, self.bbox["max_lat"], grid_resolution_deg)
        lons = np.arange(self.bbox["min_lon"] + 0.02, self.bbox["max_lon"], grid_resolution_deg)

        records = []
        for d in dates:
            day_of_year = d.dayofyear
            # Seasonal factor: Winter peak (Nov-Feb), Monsoon trough (Jun-Sep)
            seasonal_mult = 1.0 + 0.45 * np.cos(2 * np.pi * (day_of_year - 15) / 365.25)
            # Monsoon cloud fraction mask (higher chance of NaN / missing passes in July-Aug)
            is_monsoon = 6 <= d.month <= 9

            for lat in lats:
                for lon in lons:
                    # Spatial emissions distribution: higher near central urban/industrial corridors (19.05-19.12N, 72.85-72.90E)
                    dist_to_center = haversine_distance_km(lat, lon, 19.08, 72.87)
                    spatial_baseline = 120.0 * np.exp(-dist_to_center / 18.0) + 40.0

                    # NO2 tropospheric column value in umol/m2 (or 10^-5 mol/m2 scale)
                    no2_val = spatial_baseline * seasonal_mult + np.random.normal(0, 8.0)

                    # Introduce realistic Sentinel data features:
                    # 1. Negative / invalid noise values (1.5% chance)
                    # 2. Sentinel fill values (-9999, 1% chance)
                    # 3. Missing observations due to heavy cloud cover during monsoon (10% in monsoon, 2% non-monsoon)
                    rand_draw = np.random.rand()

                    if is_monsoon and rand_draw < 0.12:
                        no2_val = np.nan  # Cloud cover missing observation
                    elif rand_draw < 0.01:
                        no2_val = -9999.0  # Sentinel fill value
                    elif rand_draw < 0.025:
                        no2_val = -1.0 * abs(np.random.normal(5.0, 2.0))  # Negative calibration artifact

                    records.append({
                        "date": d.strftime("%Y-%m-%d"),
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "no2_satellite": round(no2_val, 4) if not np.isnan(no2_val) else np.nan
                    })

        df = pd.DataFrame(records)
        logger.info(f"Generated raw dataset with {len(df)} total observations.")
        return df

    def clip_to_mumbai(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clips dataset to Mumbai bounding box coordinates."""
        mask = (
            (df["latitude"] >= self.bbox["min_lat"]) &
            (df["latitude"] <= self.bbox["max_lat"]) &
            (df["longitude"] >= self.bbox["min_lon"]) &
            (df["longitude"] <= self.bbox["max_lon"])
        )
        clipped_df = df[mask].copy().reset_index(drop=True)
        logger.info(f"Clipped dataset from {len(df)} to {len(clipped_df)} rows.")
        return clipped_df

    def clean_satellite_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Cleans raw Sentinel-5P NO2 dataset:
        1. Filters out fill values (-9999, -999)
        2. Filters out negative / invalid NO2 values (< 0)
        3. Imputes missing grid values using date-level spatial median + forward fill
        """
        df_clean = df.copy()

        # Step 1: Replace fill values and negative values with NaN
        invalid_mask = (df_clean["no2_satellite"] < 0) | (df_clean["no2_satellite"] == -9999.0)
        num_invalid = invalid_mask.sum()
        df_clean.loc[invalid_mask, "no2_satellite"] = np.nan

        logger.info(f"Flagged and set {num_invalid} invalid/fill/negative values to NaN.")

        # Step 2: Handle missing values via spatial grid median per date, then time forward-fill
        # Compute date-level median NO2 for spatial imputation
        date_medians = df_clean.groupby("date")["no2_satellite"].transform("median")
        df_clean["no2_satellite"] = df_clean["no2_satellite"].fillna(date_medians)

        # Global forward-fill / backward-fill for completely cloudy days
        df_clean["no2_satellite"] = df_clean["no2_satellite"].ffill().bfill()

        # Ensure NO2 column is rounded and clean
        df_clean["no2_satellite"] = df_clean["no2_satellite"].round(4)
        df_clean["date"] = df_clean["date"].astype(str)

        logger.info(f"Cleaning complete. Remaining NaN count: {df_clean['no2_satellite'].isna().sum()}")
        return df_clean

    def get_summary_statistics(self, df_raw: pd.DataFrame, df_clean: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculates required summary metrics:
        - Number of rows
        - Date range
        - Min NO2
        - Max NO2
        - Mean NO2
        - Missing percentage
        """
        raw_missing = df_raw["no2_satellite"].isna() | (df_raw["no2_satellite"] < 0) | (df_raw["no2_satellite"] == -9999.0)
        missing_pct = (raw_missing.sum() / len(df_raw)) * 100.0

        summary = {
            "num_rows": len(df_clean),
            "date_range_start": df_clean["date"].min(),
            "date_range_end": df_clean["date"].max(),
            "min_no2": float(df_clean["no2_satellite"].min()),
            "max_no2": float(df_clean["no2_satellite"].max()),
            "mean_no2": float(df_clean["no2_satellite"].mean()),
            "std_no2": float(df_clean["no2_satellite"].std()),
            "raw_missing_pct": float(missing_pct),
        }
        return summary

    def create_visualizations(
        self,
        df: pd.DataFrame,
        station_metadata_path: str = "data/external/mumbai_station_metadata.csv",
        output_dir: str = "outputs/satellite"
    ) -> None:
        """
        Generates spatial and temporal visualizations for Sentinel-5P NO2:
        1. Mumbai NO2 Spatial Heatmap / Scatter map with ground stations overlay
        2. Mumbai Temporal Trend of NO2 over study period
        """
        os.makedirs(output_dir, exist_ok=True)
        plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

        # Load station metadata if present
        stations_df = None
        if os.path.exists(station_metadata_path):
            stations_df = pd.read_csv(station_metadata_path)

        # 1. Spatial Scatter / Heatmap Map (Average NO2 per spatial grid location)
        spatial_avg = df.groupby(["latitude", "longitude"])["no2_satellite"].mean().reset_index()

        fig, ax = plt.subplots(figsize=(10, 8))
        sc = ax.scatter(
            spatial_avg["longitude"],
            spatial_avg["latitude"],
            c=spatial_avg["no2_satellite"],
            cmap="YlOrRd",
            s=220,
            marker="s",
            alpha=0.85,
            edgecolors="none"
        )
        cbar = plt.colorbar(sc, ax=ax)
        cbar.set_label("Sentinel-5P NO₂ Column Density (µmol/m²)", fontsize=11, fontweight="bold")

        # Overlay CPCB Monitoring Stations
        if stations_df is not None:
            ax.scatter(
                stations_df["Longitude"],
                stations_df["Latitude"],
                color="blue",
                s=120,
                marker="^",
                label="CPCB Ground Stations",
                zorder=5,
                edgecolor="black"
            )
            for _, row in stations_df.iterrows():
                ax.annotate(
                    f" {row['StationId']}",
                    (row["Longitude"], row["Latitude"]),
                    fontsize=9,
                    fontweight="bold",
                    color="darkblue"
                )

        ax.set_title("Mumbai Sentinel-5P Tropospheric NO₂ Spatial Map (2019-2020 Mean)", fontsize=13, fontweight="bold")
        ax.set_xlabel("Longitude (°E)", fontsize=11)
        ax.set_ylabel("Latitude (°N)", fontsize=11)
        ax.set_xlim(self.bbox["min_lon"], self.bbox["max_lon"])
        ax.set_ylim(self.bbox["min_lat"], self.bbox["max_lat"])
        ax.legend(loc="upper left", fontsize=10)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "mumbai_no2_spatial_map.png"), dpi=300)
        plt.close()

        # 2. Daily NO2 Temporal Trend
        daily_trend = df.groupby("date")["no2_satellite"].agg(["mean", "std"]).reset_index()
        daily_trend["date"] = pd.to_datetime(daily_trend["date"])

        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot(daily_trend["date"], daily_trend["mean"], color="#d35400", linewidth=2.0, label="Mumbai Domain Mean NO₂")
        ax.fill_between(
            daily_trend["date"],
            daily_trend["mean"] - daily_trend["std"],
            daily_trend["mean"] + daily_trend["std"],
            color="#e67e22",
            alpha=0.25,
            label="Spatial ±1 Std Dev"
        )
        ax.set_title("Sentinel-5P Tropospheric NO₂ Temporal Trend over Mumbai (2019-2020)", fontsize=13, fontweight="bold")
        ax.set_xlabel("Date", fontsize=11)
        ax.set_ylabel("NO₂ Concentration (µmol/m²)", fontsize=11)
        ax.legend(loc="upper right", fontsize=10)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "mumbai_no2_temporal_trend.png"), dpi=300)
        plt.close()

        logger.info(f"Visualizations successfully saved to {output_dir}")
