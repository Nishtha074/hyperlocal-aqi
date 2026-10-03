import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

from src.spatial.baseline_models import IDWInterpolator
from src.uncertainty.conformal import SplitConformalPredictor, print_predictions_with_intervals

def run_conformal_prediction():
    print("=== Week 15: Conformal Prediction ===")
    
    # 1. Load or generate data
    try:
        df = pd.read_csv('data/processed/spatial_station_features.csv')
        lats = df.get('lat', df.get('Latitude', df.get('latitude', df.get('Lat'))))
        lons = df.get('lon', df.get('Longitude', df.get('longitude', df.get('Lon'))))
        coords = np.column_stack((lats, lons))
        target_col = 'mean_PM25' if 'mean_PM25' in df.columns else ('PM2.5' if 'PM2.5' in df.columns else 'pm25')
        values = df[target_col].values
        print(f"Loaded {len(coords)} spatial data points.")
    except FileNotFoundError:
        print("Data not found. Using synthetic spatial data.")
        np.random.seed(42)
        lats = np.random.uniform(18.9, 19.3, 100)
        lons = np.random.uniform(72.7, 73.1, 100)
        coords = np.column_stack((lats, lons))
        values = np.random.uniform(30, 80, 100)
        values += (lats - 18.9) * 50 + (lons - 72.7) * 30 + np.random.normal(0, 10, 100) # Added some noise

    # 2. Split data: 60% Train, 20% Calibration, 20% Test
    X_temp, X_test, y_temp, y_test = train_test_split(coords, values, test_size=0.2, random_state=42)
    X_train, X_calib, y_train, y_calib = train_test_split(X_temp, y_temp, test_size=0.25, random_state=42) # 0.25 * 0.8 = 0.2
    
    print(f"Data Split -> Train: {len(y_train)}, Calibration: {len(y_calib)}, Test: {len(y_test)}")
    
    # 3. Base model setup (IDW is used as an example)
    base_model = IDWInterpolator(power=2)
    
    # 4. Wrap with Conformal Predictor for a 90% confidence interval (alpha=0.1)
    alpha = 0.1
    conformal_model = SplitConformalPredictor(base_model=base_model, alpha=alpha)
    
    # 5. Fit model (fits base model on Train, computes quantiles on Calibration)
    conformal_model.fit(X_train, y_train, X_calib, y_calib)
    
    # 6. Predict on Test set
    preds, lower, upper = conformal_model.predict(X_test)
    
    # 7. Print results
    print("\nSample Predictions on Test Set:")
    print_predictions_with_intervals(preds[:5], lower[:5], upper[:5], confidence_level=int((1-alpha)*100))
    
    # 8. Check marginal coverage
    coverage = np.mean((y_test >= lower) & (y_test <= upper))
    print(f"\nEmpirical Marginal Coverage on Test Set: {coverage*100:.2f}% (Target: {int((1-alpha)*100)}%)")
    
if __name__ == "__main__":
    run_conformal_prediction()
