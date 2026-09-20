"""
Train Baseline ML Models Script for Mumbai PM2.5 Forecasting.

Executes data loading, chronological splitting, training for Linear Regression,
Random Forest, and XGBoost, exports model artifacts, logs evaluation tables,
performs error analysis on extreme episodes, and saves diagnostic figures.
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error

# Ensure src is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.forecasting.ml_baseline import BaselineMLPipeline


def main():
    print("=" * 70)
    print("WEEK 10: BASELINE MACHINE LEARNING MODELS PIPELINE")
    print("=" * 70)

    pipeline = BaselineMLPipeline(data_path="data/processed/mumbai_feature_engineered.csv")

    # PART 1 & PART 2: DATA PREPARATION & CHRONOLOGICAL SPLIT
    print("\nPART 1 & 2: DATA PREPARATION & CHRONOLOGICAL SPLIT")
    pipeline.load_and_prepare_data(train_ratio=0.8)

    n_features = pipeline.X_train.shape[1]
    print(f"Total Dataset Rows: {len(pipeline.df)}")
    print(f"Number of Features (X): {n_features}")
    print(f"Train Set Rows: {len(pipeline.X_train)} (80%)")
    print(f"Test Set Rows: {len(pipeline.X_test)} (20%)")
    print(f"Train Date Range: {pipeline.train_dates[0]} to {pipeline.train_dates[1]}")
    print(f"Test Date Range:  {pipeline.test_dates[0]} to {pipeline.test_dates[1]}")

    # PART 3: MODEL 1 — LINEAR REGRESSION
    print("\nPART 3: MODEL 1 — LINEAR REGRESSION")
    lr_metrics = pipeline.train_linear_regression()
    print(f"   Linear Regression -> MAE: {lr_metrics['MAE']:.3f}, RMSE: {lr_metrics['RMSE']:.3f}, R2: {lr_metrics['R2']:.4f}")

    # PART 4: MODEL 2 — RANDOM FOREST REGRESSOR
    print("\nPART 4: MODEL 2 — RANDOM FOREST REGRESSOR")
    rf_metrics = pipeline.train_random_forest(n_estimators=100, max_depth=10)
    print(f"   Random Forest     -> MAE: {rf_metrics['MAE']:.3f}, RMSE: {rf_metrics['RMSE']:.3f}, R2: {rf_metrics['R2']:.4f}")

    # PART 5: MODEL 3 — XGBOOST REGRESSOR
    print("\nPART 5: MODEL 3 — XGBOOST REGRESSOR")
    xgb_metrics = pipeline.train_xgboost(
        n_estimators=200, learning_rate=0.05, max_depth=6, subsample=0.8, colsample_bytree=0.8
    )
    print(f"   XGBoost Regressor -> MAE: {xgb_metrics['MAE']:.3f}, RMSE: {xgb_metrics['RMSE']:.3f}, R2: {xgb_metrics['R2']:.4f}")

    # PART 6: MODEL COMPARISON
    print("\nPART 6: MODEL COMPARISON TABLE")
    comp_df = pd.DataFrame(pipeline.metrics).T.reset_index()
    comp_df.columns = ["Model", "MAE", "RMSE", "R2"]
    print(comp_df.to_string(index=False))

    best_mae_model = comp_df.loc[comp_df["MAE"].idxmin()]["Model"]
    best_rmse_model = comp_df.loc[comp_df["RMSE"].idxmin()]["Model"]
    best_r2_model = comp_df.loc[comp_df["R2"].idxmax()]["Model"]

    print(f"\nSummary:")
    print(f"   - Best MAE:  {best_mae_model} ({comp_df['MAE'].min():.3f} µg/m³)")
    print(f"   - Best RMSE: {best_rmse_model} ({comp_df['RMSE'].min():.3f} µg/m³)")
    print(f"   - Best R2:   {best_r2_model} ({comp_df['R2'].max():.4f})")

    # PART 7: FEATURE IMPORTANCE ANALYSIS
    print("\nPART 7: TOP 20 FEATURE IMPORTANCE ANALYSIS")
    for model_name in ["Random Forest", "XGBoost"]:
        if model_name in pipeline.feature_importances:
            print(f"\n--- Top 10 Features for {model_name} ---")
            top10 = pipeline.feature_importances[model_name].head(10)
            for rank, (feat, imp) in enumerate(top10.items(), 1):
                print(f"   {rank:2d}. {feat:<25} Importance: {imp:.4f}")

    # PART 8: ERROR ANALYSIS ON HIGH POLLUTION EPISODES
    print("\nPART 8: ERROR ANALYSIS (High PM2.5 Episodes > 100 µg/m³)")
    high_mask = pipeline.y_test.values > 100.0
    n_high = np.sum(high_mask)
    print(f"Number of High Pollution Test Observations (> 100 µg/m³): {n_high} / {len(pipeline.y_test)}")

    if n_high > 0:
        for name, y_pred in pipeline.predictions.items():
            high_mae = mean_absolute_error(pipeline.y_test.values[high_mask], y_pred[high_mask])
            high_rmse = np.sqrt(mean_squared_error(pipeline.y_test.values[high_mask], y_pred[high_mask]))
            print(f"   - {name:<20} High Episode MAE: {high_mae:.2f} µg/m³, RMSE: {high_rmse:.2f} µg/m³")

    # Save artifacts & plots
    print("\nSaving Model Artifacts & Generating Publication Plots...")
    pipeline.save_artifacts()
    pipeline.generate_plots()
    print("   Models saved to 'models/' directory.")
    print("   Metrics saved to 'results/model_comparison.csv' and 'reports/model_comparison.csv'.")
    print("   Plots saved to 'reports/figures/' directory.")

    print("\nBaseline Model Pipeline Training Completed Successfully!")


if __name__ == "__main__":
    main()
