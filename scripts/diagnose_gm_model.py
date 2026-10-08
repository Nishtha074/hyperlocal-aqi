import joblib
import pandas as pd
import numpy as np
import xgboost as xgb
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import os

def main():
    print("="*50)
    print("TASK 1: FEATURE IMPORTANCE ANALYSIS")
    print("="*50)
    model = joblib.load("models/xgboost_gujarat_maharashtra.pkl")
    
    # Get feature importances
    booster = model.get_booster()
    importance = booster.get_score(importance_type='weight')
    
    # Calculate relative importance
    total_importance = sum(importance.values())
    rel_importance = {k: v/total_importance for k, v in importance.items()}
    sorted_features = sorted(rel_importance.items(), key=lambda x: x[1], reverse=True)
    
    print("\nTop 30 features by importance:")
    for i, (feat, imp) in enumerate(sorted_features[:30]):
        print(f"{i+1}. {feat}: {imp:.5f}")
        
    ranks = {feat: i+1 for i, (feat, imp) in enumerate(sorted_features)}
    
    print("\nSpecific Feature Ranks:")
    for feat in ["Latitude", "Longitude", "nearby_station_PM25", "no2_satellite"]:
        rank = ranks.get(feat, "Not found")
        print(f"{feat}: Rank {rank}")
        
    print("\nStationId Feature Ranks:")
    for feat, rank in ranks.items():
        if feat.startswith("StationId_"):
            print(f"{feat}: Rank {rank}")
            
    print("\n" + "="*50)
    print("LOAD DATA FOR TASKS 2-7")
    print("="*50)
    df = pd.read_csv("data/features/gujarat_maharashtra_features.csv")
    
    print("\n" + "="*50)
    print("TASK 2 & 3 & 4: FEATURE QUALITY & WEATHER & SATELLITE")
    print("="*50)
    
    summary_df = df.describe().T
    summary_df['missing_count'] = len(df) - summary_df['count']
    summary_df['pct_zeros'] = [(df[col] == 0).sum() / len(df) * 100 for col in summary_df.index]
    
    cols_to_print = ["Temperature", "Humidity", "WindSpeed", "Rainfall", "Pressure", "CloudCover", "WindDirection", 
                     "nearby_station_PM25", "Latitude", "Longitude", "no2_satellite"]
    
    for col in cols_to_print:
        if col in summary_df.index:
            row = summary_df.loc[col]
            print(f"\nFeature: {col}")
            print(f"  Missing: {int(row['missing_count'])}")
            print(f"  Mean: {row['mean']:.4f}")
            print(f"  Std: {row['std']:.4f}")
            print(f"  Min: {row['min']:.4f}")
            print(f"  Max: {row['max']:.4f}")
            print(f"  % Zeros: {row['pct_zeros']:.2f}%")
            if row['std'] == 0:
                print("  => CONSTANT FEATURE")
            elif row['pct_zeros'] == 100:
                print("  => ALL ZEROS")
                
    print("\n" + "="*50)
    print("TASK 5: STATION BALANCE")
    print("="*50)
    station_cols = [c for c in df.columns if c.startswith('StationId_')]
    station_counts = {}
    for col in station_cols:
        station_counts[col] = df[col].sum()
        
    for k, v in sorted(station_counts.items(), key=lambda item: item[1], reverse=True):
        print(f"{k}: {v}")
        
    min_st = min(station_counts, key=station_counts.get)
    max_st = max(station_counts, key=station_counts.get)
    print(f"\nLargest station: {max_st} ({station_counts[max_st]})")
    print(f"Smallest station: {min_st} ({station_counts[min_st]})")
    
    print("\n" + "="*50)
    print("TASK 6: TARGET DISTRIBUTION")
    print("="*50)
    print(df["target_PM25_1h"].describe())
    print("\nQuantiles:")
    print(df["target_PM25_1h"].quantile([0.5, 0.75, 0.9, 0.95, 0.99]))
    
    print("\n" + "="*50)
    print("TASK 7: ACTUAL VS PREDICTED ANALYSIS")
    print("="*50)
    # We will use the test set like in training
    df_sorted = df.copy()
    split_idx = int(len(df_sorted) * 0.8)
    test_df = df_sorted.iloc[split_idx:]
    
    target_col = "target_PM25_1h"
    feature_cols = model.feature_names_in_
    
    X_test = test_df[feature_cols]
    y_test = test_df[target_col]
    
    preds = model.predict(X_test)
    
    print("Predictions:")
    print(f"  Mean: {preds.mean():.4f}")
    print(f"  Std: {preds.std():.4f}")
    print(f"  Min: {preds.min():.4f}")
    print(f"  Max: {preds.max():.4f}")
    
    print("\nActuals:")
    print(f"  Mean: {y_test.mean():.4f}")
    print(f"  Std: {y_test.std():.4f}")
    print(f"  Min: {y_test.min():.4f}")
    print(f"  Max: {y_test.max():.4f}")
    
    # Save scatter plot
    os.makedirs("outputs", exist_ok=True)
    plt.figure(figsize=(8,6))
    plt.scatter(y_test, preds, alpha=0.1)
    plt.plot([0, y_test.max()], [0, y_test.max()], 'r--')
    plt.xlabel("Actual PM2.5")
    plt.ylabel("Predicted PM2.5")
    plt.title("Actual vs Predicted PM2.5")
    plt.savefig("outputs/actual_vs_predicted_gm.png")
    print("\nScatter plot saved to outputs/actual_vs_predicted_gm.png")
    
if __name__ == "__main__":
    main()
