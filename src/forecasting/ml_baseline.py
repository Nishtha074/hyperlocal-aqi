"""
Baseline Machine Learning Models for Time-Series PM2.5 Forecasting.

Implements Linear Regression, Random Forest, and XGBoost models
with chronological train/test splitting, performance evaluation,
feature importance extraction, and publication-quality visualizations.
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
from typing import Dict, Tuple, List, Any

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb


def evaluate_model_performance(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Computes regression evaluation metrics: MAE, RMSE, and R2 score.
    """
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    return {"MAE": mae, "RMSE": rmse, "R2": r2}


class BaselineMLPipeline:
    """
    Pipeline for loading data, training baseline models, evaluating performance,
    and generating diagnostic plots.
    """

    def __init__(self, data_path: str = "data/processed/mumbai_feature_engineered.csv"):
        self.data_path = data_path
        self.df: pd.DataFrame = None
        self.X_train: pd.DataFrame = None
        self.X_test: pd.DataFrame = None
        self.y_train: pd.Series = None
        self.y_test: pd.Series = None
        self.train_dates: Tuple[pd.Timestamp, pd.Timestamp] = (None, None)
        self.test_dates: Tuple[pd.Timestamp, pd.Timestamp] = (None, None)
        self.models: Dict[str, Any] = {}
        self.predictions: Dict[str, np.ndarray] = {}
        self.metrics: Dict[str, Dict[str, float]] = {}
        self.feature_importances: Dict[str, pd.Series] = {}

    def load_and_prepare_data(self, train_ratio: float = 0.8) -> None:
        """
        Loads engineered dataset, removes NaNs, encodes StationId,
        and performs chronological Train/Test split.
        """
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Engineered dataset not found at {self.data_path}")

        df_raw = pd.read_csv(self.data_path)
        df_raw["Datetime"] = pd.to_datetime(df_raw["Datetime"])

        # Sort chronologically by Datetime
        df_raw = df_raw.sort_values(by="Datetime").reset_index(drop=True)

        # Target variable
        target_col = "target_PM25_1h"
        if target_col not in df_raw.columns:
            raise KeyError(f"Target column '{target_col}' missing from dataset.")

        # Define explicit predictive feature list (excluding all raw unpopulated chemical columns)
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

        # One-hot encode StationId if present
        if "StationId" in df_raw.columns:
            df_encoded = pd.get_dummies(df_raw, columns=["StationId"], drop_first=False)
            station_dummy_cols = [c for c in df_encoded.columns if c.startswith("StationId_")]
        else:
            df_encoded = df_raw.copy()
            station_dummy_cols = []

        feature_cols = [c for c in base_feature_cols if c in df_encoded.columns] + station_dummy_cols

        # Filter dataset to rows with valid target AND valid feature set
        df_clean = df_encoded.dropna(subset=[target_col] + feature_cols).reset_index(drop=True)

        X = df_clean[feature_cols]
        y = df_clean[target_col]

        # Chronological split
        n_samples = len(df_clean)
        split_idx = int(n_samples * train_ratio)

        self.X_train = X.iloc[:split_idx].copy()
        self.y_train = y.iloc[:split_idx].copy()
        self.X_test = X.iloc[split_idx:].copy()
        self.y_test = y.iloc[split_idx:].copy()

        self.train_dates = (df_clean["Datetime"].iloc[0], df_clean["Datetime"].iloc[split_idx - 1])
        self.test_dates = (df_clean["Datetime"].iloc[split_idx], df_clean["Datetime"].iloc[-1])
        self.df = df_clean

    def train_linear_regression(self) -> Dict[str, float]:
        """
        Trains Linear Regression baseline model.
        """
        model = LinearRegression()
        model.fit(self.X_train, self.y_train)

        y_pred = model.predict(self.X_test)
        metrics = evaluate_model_performance(self.y_test.values, y_pred)

        self.models["Linear Regression"] = model
        self.predictions["Linear Regression"] = y_pred
        self.metrics["Linear Regression"] = metrics
        return metrics

    def train_random_forest(self, n_estimators: int = 100, max_depth: int = 10) -> Dict[str, float]:
        """
        Trains Random Forest Regressor.
        """
        model = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
            n_jobs=-1
        )
        model.fit(self.X_train, self.y_train)

        y_pred = model.predict(self.X_test)
        metrics = evaluate_model_performance(self.y_test.values, y_pred)

        self.models["Random Forest"] = model
        self.predictions["Random Forest"] = y_pred
        self.metrics["Random Forest"] = metrics
        self.feature_importances["Random Forest"] = pd.Series(
            model.feature_importances_, index=self.X_train.columns
        ).sort_values(ascending=False)

        return metrics

    def train_xgboost(
        self,
        n_estimators: int = 200,
        learning_rate: float = 0.05,
        max_depth: int = 6,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8
    ) -> Dict[str, float]:
        """
        Trains XGBoost Regressor.
        """
        model = xgb.XGBRegressor(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            max_depth=max_depth,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            random_state=42,
            n_jobs=-1
        )
        model.fit(self.X_train, self.y_train)

        y_pred = model.predict(self.X_test)
        metrics = evaluate_model_performance(self.y_test.values, y_pred)

        self.models["XGBoost"] = model
        self.predictions["XGBoost"] = y_pred
        self.metrics["XGBoost"] = metrics
        self.feature_importances["XGBoost"] = pd.Series(
            model.feature_importances_, index=self.X_train.columns
        ).sort_values(ascending=False)

        return metrics

    def save_artifacts(self, models_dir: str = "models", results_dir: str = "results") -> None:
        """
        Saves model .pkl files and comparison CSV.
        """
        os.makedirs(models_dir, exist_ok=True)
        os.makedirs(results_dir, exist_ok=True)
        os.makedirs("reports", exist_ok=True)

        filename_map = {
            "Linear Regression": "linear_regression.pkl",
            "Random Forest": "random_forest.pkl",
            "XGBoost": "xgboost.pkl",
        }

        for name, model in self.models.items():
            save_path = os.path.join(models_dir, filename_map[name])
            joblib.dump(model, save_path)

        # Save comparison metrics CSV
        comp_df = pd.DataFrame(self.metrics).T.reset_index()
        comp_df.columns = ["Model", "MAE", "RMSE", "R2"]
        comp_df.to_csv(os.path.join(results_dir, "model_comparison.csv"), index=False)
        comp_df.to_csv("reports/model_comparison.csv", index=False)

    def generate_plots(self, figures_dir: str = "reports/figures") -> None:
        """
        Generates publication-quality diagnostic plots.
        """
        os.makedirs(figures_dir, exist_ok=True)
        plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

        # 1. Actual vs Predicted Plot (All Models Overlaid Sample)
        fig, ax = plt.subplots(figsize=(14, 6))
        sample_len = min(300, len(self.y_test))
        time_axis = np.arange(sample_len)

        ax.plot(time_axis, self.y_test.values[:sample_len], label="Actual PM2.5", color="black", linewidth=2.0, alpha=0.8)
        colors = {"Linear Regression": "#e74c3c", "Random Forest": "#2ecc71", "XGBoost": "#3498db"}

        for name, y_pred in self.predictions.items():
            ax.plot(time_axis, y_pred[:sample_len], label=f"{name} Forecast", color=colors.get(name, "blue"), linestyle="--", alpha=0.8)

        ax.set_title("Hyperlocal PM2.5 Forecast: Actual vs. Predicted (Test Subset)", fontsize=14, fontweight="bold")
        ax.set_xlabel("Time Step (Hours)", fontsize=12)
        ax.set_ylabel("PM2.5 Concentration (µg/m³)", fontsize=12)
        ax.legend(fontsize=11)
        plt.tight_layout()
        plt.savefig(os.path.join(figures_dir, "actual_vs_predicted_all_models.png"), dpi=300)
        plt.close()

        # 2. Residual Plots
        fig, axes = plt.subplots(1, 3, figsize=(18, 5))
        for idx, (name, y_pred) in enumerate(self.predictions.items()):
            residuals = self.y_test.values - y_pred
            axes[idx].scatter(y_pred, residuals, alpha=0.3, color=colors.get(name, "blue"), edgecolors="none")
            axes[idx].axhline(0, color="red", linestyle="--", linewidth=1.5)
            axes[idx].set_title(f"{name} Residuals", fontsize=12, fontweight="bold")
            axes[idx].set_xlabel("Predicted PM2.5 (µg/m³)", fontsize=10)
            axes[idx].set_ylabel("Residual (Actual - Predicted)", fontsize=10)

        plt.tight_layout()
        plt.savefig(os.path.join(figures_dir, "residual_plots.png"), dpi=300)
        plt.close()

        # 3. Top 20 Feature Importance Comparison
        fig, axes = plt.subplots(1, 2, figsize=(16, 8))
        for idx, model_name in enumerate(["Random Forest", "XGBoost"]):
            if model_name in self.feature_importances:
                top20 = self.feature_importances[model_name].head(20).sort_values()
                axes[idx].barh(top20.index, top20.values, color=colors[model_name])
                axes[idx].set_title(f"Top 20 Features — {model_name}", fontsize=13, fontweight="bold")
                axes[idx].set_xlabel("Importance Score", fontsize=11)

        plt.tight_layout()
        plt.savefig(os.path.join(figures_dir, "feature_importance_top20.png"), dpi=300)
        plt.close()

        # 4. Error Distribution Histogram
        fig, ax = plt.subplots(figsize=(10, 6))
        for name, y_pred in self.predictions.items():
            residuals = self.y_test.values - y_pred
            sns.kdeplot(residuals, ax=ax, label=f"{name} (MAE={self.metrics[name]['MAE']:.2f})", color=colors.get(name, "blue"), linewidth=2)

        ax.set_title("Prediction Error Distribution (Residuals: Actual - Predicted)", fontsize=14, fontweight="bold")
        ax.set_xlabel("Forecast Error (µg/m³)", fontsize=12)
        ax.set_ylabel("Density", fontsize=12)
        ax.legend(fontsize=11)
        plt.tight_layout()
        plt.savefig(os.path.join(figures_dir, "error_distribution_histogram.png"), dpi=300)
        plt.close()

        # 5. Correlation Heatmap of Key Features
        fig, ax = plt.subplots(figsize=(12, 10))
        key_cols = [
            "PM2.5", "PM25_lag_1", "PM25_lag_24", "pm25_roll_3h",
            "Temperature", "Humidity", "WindSpeed", "Rainfall",
            "sin_hour", "cos_hour", "nearby_station_PM25", "target_PM25_1h"
        ]
        present_key_cols = [c for c in key_cols if c in self.df.columns]
        corr_matrix = self.df[present_key_cols].corr()

        sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap="coolwarm", vmin=-1, vmax=1, ax=ax)
        ax.set_title("Correlation Heatmap of Primary PM2.5 Features", fontsize=14, fontweight="bold")
        plt.tight_layout()
        plt.savefig(os.path.join(figures_dir, "correlation_heatmap.png"), dpi=300)
        plt.close()
