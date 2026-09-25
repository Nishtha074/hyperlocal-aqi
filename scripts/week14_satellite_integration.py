"""
Week 14 Script: Integrate Satellite + Ground Data, Train & Evaluate XGBoost Models.

Outputs:
1. data/features/model_with_satellite.csv
2. models/xgboost_with_satellite.pkl
3. results/satellite_model_comparison.csv
4. Diagnostic plots in outputs/model_with_satellite/
"""

import os
import sys
import pandas as pd

# Add src to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.data.satellite_integration import SatelliteGroundIntegrator
from src.forecasting.xgboost_satellite import XGBoostSatellitePipeline


def main():
    print("=" * 70)
    print("WEEK 14: SATELLITE + GROUND DATA INTEGRATION & XGBOOST MODELING")
    print("=" * 70)

    # STEP 1 & 2: MERGE DATASETS AND SAVE FEATURE DATASET
    print("\nSTEP 1 & 2: MERGING SATELLITE NO2 WITH GROUND CPCB DATA")
    integrator = SatelliteGroundIntegrator(
        ground_data_path="data/processed/mumbai_feature_engineered.csv",
        satellite_data_path="data/processed/mumbai_satellite_no2.csv"
    )
    feature_df = integrator.merge_datasets()
    integrator.save_feature_dataset(output_path="data/features/model_with_satellite.csv")

    # STEP 3 & 4: TRAIN AND EVALUATE XGBOOST MODELS
    print("\nSTEP 3 & 4: TRAINING & EVALUATING BASELINE VS SATELLITE XGBOOST")
    pipeline = XGBoostSatellitePipeline(data_path="data/features/model_with_satellite.csv")
    pipeline.load_and_prepare_data(train_ratio=0.8)

    print("\n--- Model A: Baseline XGBoost (Without Satellite) ---")
    base_metrics = pipeline.train_baseline_xgboost()

    print("\n--- Model B: Satellite XGBoost (With Sentinel-5P NO2) ---")
    sat_metrics = pipeline.train_satellite_xgboost()

    # STEP 5: FEATURE IMPORTANCE ANALYSIS
    print("\nSTEP 5: FEATURE IMPORTANCE ANALYSIS")
    rank_info = pipeline.get_satellite_feature_rank()
    print(f"   - Rank of 'no2_satellite': {rank_info['rank']} / {rank_info['total_features']}")
    print(f"   - Importance Score:        {rank_info['importance_score']:.5f}")
    print("\n   Top 10 Features in Satellite XGBoost:")
    for idx, (feat, imp) in enumerate(rank_info["top_10_features"].items(), 1):
        marker = " <--- SATELLITE FEATURE" if feat == "no2_satellite" else ""
        print(f"     {idx:2d}. {feat:<25} Importance: {imp:.4f}{marker}")

    # STEP 6: EXPERIMENT COMPARISON SUMMARY
    print("\nSTEP 6: FINAL EXPERIMENT COMPARISON SUMMARY")
    comp_df = pipeline.compute_experiment_comparison()
    print("\n" + comp_df.to_string(index=False))

    # Save artifacts & plots
    print("\nSaving Artifacts & Visualizations...")
    pipeline.save_artifacts()
    pipeline.create_visualizations(output_dir="outputs/model_with_satellite")

    print("\n   - Model saved to 'models/xgboost_with_satellite.pkl'")
    print("   - Metrics table saved to 'results/satellite_model_comparison.csv'")
    print("   - Plots saved to 'outputs/model_with_satellite/'")

    print("\nWeek 14 Satellite Integration Pipeline Completed Successfully!")


if __name__ == "__main__":
    main()
