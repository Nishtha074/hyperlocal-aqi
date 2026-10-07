from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

from src.risk.personalized_risk import calculate_personalized_risk, calculate_personalized_threshold, normalize_profile
from src.uncertainty.forecast_uncertainty import get_uncertainty_snapshot


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_data_path(*parts: str) -> Path:
    return project_root().joinpath(*parts)


def safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return default
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default
        try:
            return float(text)
        except ValueError:
            return default
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    if np.isnan(numeric):
        return default
    return numeric


def validate_bad_data(df: pd.DataFrame) -> pd.DataFrame:
    """Return a cleaned copy that drops clearly invalid rows without crashing."""
    if df is None or df.empty:
        return pd.DataFrame()
    cleaned = df.copy()

    # Required fields when present should remain numeric and not obviously invalid.
    for column in ["AQI", "PM2.5", "PM10"]:
        if column in cleaned.columns:
            cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")
            cleaned = cleaned[(cleaned[column].isna()) | ((cleaned[column] >= 0) & (cleaned[column] <= 1000))]

    if "Latitude" in cleaned.columns:
        cleaned["Latitude"] = pd.to_numeric(cleaned["Latitude"], errors="coerce")
        cleaned = cleaned[cleaned["Latitude"].between(-90, 90) | cleaned["Latitude"].isna()]

    if "Longitude" in cleaned.columns:
        cleaned["Longitude"] = pd.to_numeric(cleaned["Longitude"], errors="coerce")
        cleaned = cleaned[cleaned["Longitude"].between(-180, 180) | cleaned["Longitude"].isna()]

    if "Datetime" in cleaned.columns:
        cleaned["Datetime"] = pd.to_datetime(cleaned["Datetime"], errors="coerce")
        cleaned = cleaned.dropna(subset=["Datetime"])

    return cleaned.reset_index(drop=True)


def load_station_data() -> pd.DataFrame:
    path = resolve_data_path("data", "processed", "spatial_station_features.csv")
    if not path.exists():
        return pd.DataFrame(columns=["StationId", "StationName", "City", "Latitude", "Longitude", "mean_PM25"])

    try:
        df = pd.read_csv(path)
        df = validate_bad_data(df)
        if df.empty:
            return pd.DataFrame(columns=["StationId", "StationName", "City", "Latitude", "Longitude", "mean_PM25"])

        lat_col = next((c for c in ["Latitude", "latitude", "lat", "Lat"] if c in df.columns), None)
        lon_col = next((c for c in ["Longitude", "longitude", "lon", "Lon"] if c in df.columns), None)
        station_col = next((c for c in ["StationName", "Station", "station_name", "StationId"] if c in df.columns), None)
        pm_col = next((c for c in ["mean_PM25", "PM2.5", "PM25", "pm25"] if c in df.columns), None)

        if lat_col is None or lon_col is None:
            return pd.DataFrame(columns=["StationId", "StationName", "City", "Latitude", "Longitude", "mean_PM25"])

        result = pd.DataFrame({
            "StationId": df.get("StationId", df.get("Station", "Unknown")),
            "StationName": df.get(station_col, "Unknown") if station_col else "Unknown",
            "City": df.get("City", "Unknown"),
            "Latitude": pd.to_numeric(df[lat_col], errors="coerce"),
            "Longitude": pd.to_numeric(df[lon_col], errors="coerce"),
            "mean_PM25": pd.to_numeric(df[pm_col], errors="coerce") if pm_col else np.nan,
        })
        result = result.dropna(subset=["Latitude", "Longitude"]).reset_index(drop=True)
        return result
    except Exception:
        return pd.DataFrame(columns=["StationId", "StationName", "City", "Latitude", "Longitude", "mean_PM25"])


def get_latest_air_quality_snapshot() -> Dict[str, Any]:
    candidates = [
        resolve_data_path("data", "processed", "master_pollution_weather.csv"),
        resolve_data_path("data", "processed", "mumbai_feature_engineered.csv"),
        resolve_data_path("data", "features", "model_with_satellite.csv"),
        resolve_data_path("data", "processed", "clean_air_quality.csv"),
    ]

    for path in candidates:
        if not path.exists():
            continue
        try:
            df = pd.read_csv(path)
            df = validate_bad_data(df)
            if df.empty:
                continue
            if "Datetime" in df.columns:
                df["Datetime"] = pd.to_datetime(df["Datetime"], errors="coerce")
                df = df.dropna(subset=["Datetime"]).sort_values("Datetime").reset_index(drop=True)
            else:
                continue

            if df.empty:
                continue

            current_aqi = safe_float(df["AQI"].dropna().iloc[-1]) if "AQI" in df.columns else None
            current_pm25 = safe_float(df["PM2.5"].dropna().iloc[-1]) if "PM2.5" in df.columns else None
            current_pm10 = safe_float(df["PM10"].dropna().iloc[-1]) if "PM10" in df.columns else None
            last_dt = df["Datetime"].dropna().iloc[-1]

            forecast_map: Dict[int, float] = {}
            for horizon in [1, 2, 3, 4, 5, 6]:
                target_col = f"target_{horizon}h" if horizon != 1 else "target_1h"
                if target_col in df.columns:
                    value = safe_float(df[target_col].dropna().iloc[-1])
                    if value is not None:
                        forecast_map[horizon] = value

            if not forecast_map:
                for key in ["target_PM25_1h", "forecast_aqi"]:
                    if key in df.columns:
                        value = safe_float(df[key].dropna().iloc[-1])
                        if value is not None:
                            forecast_map[1] = value
                            break

            if 1 in forecast_map and 3 in forecast_map and 2 not in forecast_map:
                forecast_map[2] = float(np.interp(2, [1, 3], [forecast_map[1], forecast_map[3]]))
            if 3 in forecast_map and 6 in forecast_map:
                for hour in [4, 5]:
                    if hour not in forecast_map:
                        forecast_map[hour] = float(np.interp(hour, [3, 6], [forecast_map[3], forecast_map[6]]))

            uncertainty = get_uncertainty_snapshot(
                forecast_aqi=next(iter(forecast_map.values()), None),
                current_aqi=current_aqi,
            )

            return {
                "location": df.get("City", pd.Series(["Mumbai"] * len(df))).dropna().iloc[-1] if "City" in df.columns else "Mumbai",
                "last_updated": last_dt,
                "current_aqi": current_aqi,
                "pm25": current_pm25,
                "pm10": current_pm10,
                "forecast_map": forecast_map,
                "uncertainty": uncertainty,
            }
        except Exception:
            continue

    return {
        "location": "Mumbai",
        "last_updated": pd.Timestamp.now(tz=None),
        "current_aqi": None,
        "pm25": None,
        "pm10": None,
        "forecast_map": {},
        "uncertainty": None,
    }


def forecast_table_for_snapshot(snapshot: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
    forecast_map = snapshot.get("forecast_map", {}) or {}
    if not forecast_map:
        return pd.DataFrame(columns=["offset_hours", "timestamp", "predicted_aqi", "risk_level"])

    profile = normalize_profile(profile)
    threshold = calculate_personalized_threshold(
        age_group=profile["age_group"],
        activity_level=profile["activity_level"],
        sensitivity_category=profile["sensitivity_category"],
    )
    base_time = snapshot.get("last_updated")
    if base_time is None:
        base_time = pd.Timestamp.now()

    rows = []
    for hour in sorted(forecast_map):
        value = forecast_map[hour]
        risk = calculate_personalized_risk(
            current_aqi=0,
            forecast_aqi=value,
            forecast_time=base_time + pd.Timedelta(hours=hour),
            profile=profile,
        )
        rows.append({
            "offset_hours": hour,
            "timestamp": base_time + pd.Timedelta(hours=hour),
            "predicted_aqi": value,
            "risk_level": risk["risk_level"],
            "threshold": threshold,
        })
    return pd.DataFrame(rows)


def risk_recommendation_for_level(risk_level: str) -> str:
    if risk_level == "Very High":
        return "Reduce prolonged outdoor activity and consider shorter, lower-exertion exposure windows."
    if risk_level == "High":
        return "Limit extended outdoor exertion and monitor air quality conditions during the next few hours."
    if risk_level == "Moderate":
        return "Stay mindful of localized air quality and consider reducing prolonged outdoor activity if needed."
    return "Air quality conditions are comparatively favorable. Continue normal outdoor activity with routine awareness."


def get_model_info() -> Dict[str, Any]:
    comparison = None
    model_metrics_path = resolve_data_path("results", "model_comparison.csv")
    if model_metrics_path.exists():
        comparison = pd.read_csv(model_metrics_path)

    lstm_path = resolve_data_path("results", "lstm_metrics.csv")
    lstm_metrics = pd.read_csv(lstm_path) if lstm_path.exists() else None

    info = {
        "model_name": "XGBoost + LSTM baseline",
        "model_type": "Gradient boosting regressor and sequence model",
        "training_dataset": "data/processed/mumbai_feature_engineered.csv",
        "prediction_target": "PM2.5 target_1h / forecast horizon targets",
        "features_used": [
            "PM2.5 lag features",
            "meteorological variables",
            "seasonal/time features",
            "station and spatial features",
        ],
        "mae": None,
        "rmse": None,
        "r2": None,
        "confidence": "Not available",
        "prediction_interval": "Not available",
        "train_test_split": "Chronological split at 80% / 20%",
        "preprocessing": "Numerical cleaning, chronological ordering, feature engineering, PM2.5 target alignment",
    }

    if comparison is not None and not comparison.empty:
        xgb_row = comparison[comparison["Model"].str.lower().str.contains("xgboost")]
        if not xgb_row.empty:
            row = xgb_row.iloc[0]
            info["mae"] = float(row.get("MAE", np.nan))
            info["rmse"] = float(row.get("RMSE", np.nan))
            info["r2"] = float(row.get("R2", np.nan))
    if lstm_metrics is not None and not lstm_metrics.empty:
        info["model_name"] = "XGBoost + LSTM benchmark"
        info["prediction_interval"] = "Sequence evaluation uses horizon-based intervals; interval estimates are not produced by default in this project"

    return info


def no_station_message() -> str:
    return "No nearby monitoring station available."
