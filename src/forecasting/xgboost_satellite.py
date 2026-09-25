"""
XGBoost Satellite Integration Pipeline.

Trains and compares baseline XGBoost (ground features only) vs satellite-enhanced XGBoost
(ground features + Sentinel-5P NO2). Computes metric improvements, feature importance ranks,
and diagnostic visualization plots.
"""

import os
import logging
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import xgboost as xgb
from typing import Dict, Tuple, List, Any
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def evaluate_model_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes MAE, RMSE, and R2 regression evaluation metrics."""
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    return {"MAE": float(mae), "RMSE": float(rmse), "R2": float(r2)}


class XGBoostSatellitePipeline:
    """
    Pipeline for training XGBoost models with and without satellite NO2 feature,
    evaluating comparative metrics, extracting feature importance, and generating plots.
    """

    def __init__(self, data_path: str = "data/features/model_with_satellite.csv"):
        self.data_path = data_path
        self.df: pd.DataFrame = None
        self.X_train_base: pd.DataFrame = None
        self.X_test_base: pd.DataFrame = None
        self.X_train_sat: pd.DataFrame = None
        self.X_test_sat: pd.DataFrame = None
        self.y_train: pd.Series = None
        self.y_test: pd.Series = None
        self.models: Dict[str, Any] = {}
        self.predictions: Dict[str, np.ndarray] = {}
        self.metrics: Dict[str, Dict[str, float]] = {}
        self.feature_importances: Dict[str, pd.Series] = {}

    def load_and_prepare_data(self, train_ratio: float = 0.8) -> None:
        """
        Loads integrated feature dataset, sorts chronologically,
        and splits into train and test sets (80/20 ratio).
        """
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Feature dataset not found at {self.data_path}")

        df_raw = pd.read_csv(self.data_path)
        df_raw["Datetime"] = pd.to_datetime(df_raw["Datetime"])
        df_raw = df_raw.sort_values(by="Datetime").reset_index(drop=True)

        target_col = "target_PM25_1h"
        if target_col not in df_raw.columns:
            raise KeyError(f"Target column '{target_col}' missing.")

        base_feature_cols = [
            "PM2.5", "PM25_lag_1", "PM25_lag_2", "PM25_lag_3", "PM25_lag_6", "PM25_lag_12", "PM25_lag_24",
            "Temperature", "Humidity", "WindSpeed", "Rainfall", "Pressure", "CloudCover", "WindDirection",
            "temp_roll_3h", "temp_roll_6h", "humidity_roll_3h", "humidity_roll_6h",
            "wind_speed_roll_3h", "wind_speed_roll_6h", "pm25_roll_3h", "pm25_roll_6h",
            "temp_change_1h", "humidity_change_1h", "wind_speed_change_1h",
            "is_raining", "rain_roll_3h",
            "hour", "day", "month", "day_of_week", "is_weekend",
            "sin_hour", "cos_hour", "sin_month", "cos_month",
            "Latitude", "Longitude", "nearby_station_PM25"
        ]

        if "StationId" in df_raw.columns:
            df_encoded = pd.get_dummies(df_raw, columns=["StationId"], drop_first=False)
            station_dummy_cols = [c for c in df_encoded.columns if c.startswith("StationId_")]
        else:
            df_encoded = df_raw.copy()
            station_dummy_cols = []

        ground_features = [c for c in base_feature_cols if c in df_encoded.columns] + station_dummy_cols
        sat_features = ground_features + ["no2_satellite"]

        # Clean rows with valid target and features
        df_clean = df_encoded.dropna(subset=[target_col] + sat_features).reset_index(drop=True)

        X_base = df_clean[ground_features]
        X_sat = df_clean[sat_features]
        y = df_clean[target_col]

        # Chronological split
        split_idx = int(len(df_clean) * train_ratio)

        self.X_train_base = X_base.iloc[:split_idx].copy()
        self.X_test_base = X_base.iloc[split_idx:].copy()
        self.X_train_sat = X_sat.iloc[:split_idx].copy()
        self.X_test_sat = X_sat.iloc[split_idx:].copy()
        self.y_train = y.iloc[:split_idx].copy()
        self.y_test = y.iloc[split_idx:].copy()
        self.df = df_clean

        logger.info(f"Loaded {len(df_clean)} samples. Train: {len(self.X_train_sat)}, Test: {len(self.X_test_sat)}")
        logger.info(f"Baseline features count: {len(ground_features)}, Satellite features count: {len(sat_features)}")

    def train_baseline_xgboost(self) -> Dict[str, float]:
        """Trains Model A (XGBoost without satellite NO2)."""
        logger.info("Training Baseline XGBoost (Model A: Ground Features Only)...")
        model = xgb.XGBRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        )
        model.fit(self.X_train_base, self.y_train)

        y_pred = model.predict(self.X_test_base)
        metrics = evaluate_model_metrics(self.y_test.values, y_pred)

        self.models["Baseline (Without Satellite)"] = model
        self.predictions["Baseline (Without Satellite)"] = y_pred
        self.metrics["Baseline (Without Satellite)"] = metrics
        self.feature_importances["Baseline (Without Satellite)"] = pd.Series(
            model.feature_importances_, index=self.X_train_base.columns
        ).sort_values(ascending=False)

        logger.info(f"Baseline XGBoost -> MAE: {metrics['MAE']:.3f}, RMSE: {metrics['RMSE']:.3f}, R2: {metrics['R2']:.4f}")
        return metrics

    def train_satellite_xgboost(self) -> Dict[str, float]:
        """Trains Model B (XGBoost with Sentinel-5P NO2)."""
        logger.info("Training Satellite XGBoost (Model B: Ground Features + Satellite NO2)...")
        model = xgb.XGBRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        )
        model.fit(self.X_train_sat, self.y_train)

        y_pred = model.predict(self.X_test_sat)
        metrics = evaluate_model_metrics(self.y_test.values, y_pred)

        self.models["With Satellite NO2"] = model
        self.predictions["With Satellite NO2"] = y_pred
        self.metrics["With Satellite NO2"] = metrics
        self.feature_importances["With Satellite NO2"] = pd.Series(
            model.feature_importances_, index=self.X_train_sat.columns
        ).sort_values(ascending=False)

        logger.info(f"Satellite XGBoost -> MAE: {metrics['MAE']:.3f}, RMSE: {metrics['RMSE']:.3f}, R2: {metrics['R2']:.4f}")
        return metrics

    def compute_experiment_comparison(self) -> pd.DataFrame:
        """
        Computes metric comparison table and percentage improvement.
        """
        m_base = self.metrics["Baseline (Without Satellite)"]
        m_sat = self.metrics["With Satellite NO2"]

        mae_imp = ((m_base["MAE"] - m_sat["MAE"]) / m_base["MAE"]) * 100.0
        rmse_imp = ((m_base["RMSE"] - m_sat["RMSE"]) / m_base["RMSE"]) * 100.0
        r2_imp = ((m_sat["R2"] - m_base["R2"]) / abs(m_base["R2"])) * 100.0 if m_base["R2"] != 0 else 0.0

        comparison_df = pd.DataFrame([
            {"Metric": "MAE (µg/m³)", "Baseline": round(m_base["MAE"], 3), "With Satellite": round(m_sat["MAE"], 3), "Improvement (%)": round(mae_imp, 2)},
            {"Metric": "RMSE (µg/m³)", "Baseline": round(m_base["RMSE"], 3), "With Satellite": round(m_sat["RMSE"], 3), "Improvement (%)": round(rmse_imp, 2)},
            {"Metric": "R² Score", "Baseline": round(m_base["R2"], 4), "With Satellite": round(m_sat["R2"], 4), "Improvement (%)": round(r2_imp, 2)},
        ])

        return comparison_df

    def get_satellite_feature_rank(self) -> Dict[str, Any]:
        """
        Extracts rank and importance score of 'no2_satellite' in Model B.
        """
        fi = self.feature_importances["With Satellite NO2"]
        if "no2_satellite" not in fi:
            raise KeyError("'no2_satellite' missing from feature importances.")

        rank = list(fi.index).index("no2_satellite") + 1
        score = float(fi["no2_satellite"])
        top_10 = fi.head(10).to_dict()

        return {
            "rank": rank,
            "total_features": len(fi),
            "importance_score": round(score, 5),
            "top_10_features": top_10
        }

    def save_artifacts(self, models_dir: str = "models", results_dir: str = "results") -> None:
        """Saves trained model file and evaluation comparison tables."""
        os.makedirs(models_dir, exist_ok=True)
        os.makedirs(results_dir, exist_ok=True)

        sat_model_path = os.path.join(models_dir, "xgboost_with_satellite.pkl")
        joblib.dump(self.models["With Satellite NO2"], sat_model_path)
        logger.info(f"Saved satellite XGBoost model to {sat_model_path}")

        comp_df = self.compute_experiment_comparison()
        comp_df.to_csv(os.path.join(results_dir, "satellite_model_comparison.csv"), index=False)
        logger.info(f"Saved metric comparison table to {os.path.join(results_dir, 'satellite_model_comparison.csv')}")

    def create_visualizations(self, output_dir: str = "outputs/model_with_satellite") -> None:
        """
        Generates required diagnostic plots:
        1. Feature importance plot (Highlighting no2_satellite and Top 10)
        2. Metric comparison bar charts (MAE, RMSE, R2)
        3. Actual vs Predicted time-series comparison
        """
        os.makedirs(output_dir, exist_ok=True)
        plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

        # 1. Feature Importance Plot (Top 15 features with no2_satellite highlighted)
        fi = self.feature_importances["With Satellite NO2"].head(15).sort_values(ascending=True)
        colors = ["#e74c3c" if feat == "no2_satellite" else "#3498db" for feat in fi.index]

        fig, ax = plt.subplots(figsize=(10, 6))
        bars = ax.barh(fi.index, fi.values, color=colors, edgecolor="none", alpha=0.9)
        ax.set_title("XGBoost Feature Importance (Ground Features + Sentinel-5P NO₂)", fontsize=13, fontweight="bold")
        ax.set_xlabel("Feature Importance Score (Gain)", fontsize=11)

        # Highlight no2_satellite bar
        for bar, feat in zip(bars, fi.index):
            if feat == "no2_satellite":
                ax.annotate(
                    f" {bar.get_width():.4f} (Satellite Feature)",
                    (bar.get_width(), bar.get_y() + bar.get_height() / 2),
                    va="center",
                    fontweight="bold",
                    color="#c0392b"
                )

        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "xgboost_satellite_feature_importance.png"), dpi=300)
        plt.close()

        # 2. Metric Comparison Bar Plot
        comp_df = self.compute_experiment_comparison()
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))

        metrics_list = ["MAE (µg/m³)", "RMSE (µg/m³)", "R² Score"]
        bar_colors = ["#2ecc71", "#3498db"]

        for idx, metric_name in enumerate(metrics_list):
            row = comp_df[comp_df["Metric"] == metric_name].iloc[0]
            values = [row["Baseline"], row["With Satellite"]]
            labels = ["Baseline", "With Satellite"]

            axes[idx].bar(labels, values, color=bar_colors, width=0.5, edgecolor="black", alpha=0.85)
            axes[idx].set_title(metric_name, fontsize=12, fontweight="bold")

            for i, v in enumerate(values):
                axes[idx].text(i, v * 1.01, f"{v}", ha="center", va="bottom", fontweight="bold")

        plt.suptitle("XGBoost Forecasting Performance: Baseline vs. Satellite NO₂", fontsize=14, fontweight="bold")
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "baseline_vs_satellite_metrics.png"), dpi=300)
        plt.close()

        # 3. Time-Series Actual vs Predicted Comparison
        fig, ax = plt.subplots(figsize=(14, 6))
        sample_len = min(300, len(self.y_test))
        time_axis = np.arange(sample_len)

        ax.plot(time_axis, self.y_test.values[:sample_len], label="Actual PM2.5", color="black", linewidth=2.0, alpha=0.8)
        ax.plot(time_axis, self.predictions["Baseline (Without Satellite)"][:sample_len], label="Baseline XGBoost", color="#e74c3c", linestyle="--", alpha=0.8)
        ax.plot(time_axis, self.predictions["With Satellite NO2"][:sample_len], label="Satellite-Enhanced XGBoost", color="#2ecc71", linestyle="-.", alpha=0.8)

        ax.set_title("PM2.5 1-Hour Ahead Forecast: Baseline vs. Satellite XGBoost", fontsize=13, fontweight="bold")
        ax.set_xlabel("Time Step (Hours)", fontsize=11)
        ax.set_ylabel("PM2.5 (µg/m³)", fontsize=11)
        ax.legend(loc="upper right", fontsize=11)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "actual_vs_predicted_satellite.png"), dpi=300)
        plt.close()

        logger.info(f"Visualizations saved to {output_dir}")
