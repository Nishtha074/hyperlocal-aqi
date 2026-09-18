import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pandas as pd
import numpy as np
from sklearn.model_selection import KFold

from src.spatial.baseline_models import NearestNeighborInterpolator, IDWInterpolator, evaluate_model
from src.spatial.kriging_model import KrigingInterpolator

def run_comparison():
    try:
        df = pd.read_csv('data/processed/spatial_station_features.csv')
        lats = df.get('lat', df.get('Latitude', df.get('latitude', df.get('Lat'))))
        lons = df.get('lon', df.get('Longitude', df.get('longitude', df.get('Lon'))))
        coords = np.column_stack((lats, lons))
        target_col = 'mean_PM25' if 'mean_PM25' in df.columns else ('PM2.5' if 'PM2.5' in df.columns else 'pm25')
        values = df[target_col].values
    except FileNotFoundError:
        print("Data not found. Using synthetic sparse data for demonstration.")
        np.random.seed(42)
        lats = np.random.uniform(18.9, 19.3, 30)
        lons = np.random.uniform(72.7, 73.1, 30)
        coords = np.column_stack((lats, lons))
        values = np.random.uniform(30, 80, 30)
        # Adding a spatial gradient
        values += (lats - 18.9) * 50 + (lons - 72.7) * 30

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    
    results = {
        'NN': {'mae': [], 'rmse': []},
        'IDW': {'mae': [], 'rmse': []},
        'Kriging': {'mae': [], 'rmse': []}
    }

    for train_idx, test_idx in kf.split(coords):
        X_train, X_test = coords[train_idx], coords[test_idx]
        y_train, y_test = values[train_idx], values[test_idx]
        
        # 1. Nearest Neighbor
        knn = NearestNeighborInterpolator().fit(X_train, y_train)
        metrics = evaluate_model(y_test, knn.predict(X_test))
        results['NN']['mae'].append(metrics['MAE'])
        results['NN']['rmse'].append(metrics['RMSE'])
        
        # 2. IDW
        idw = IDWInterpolator(power=2).fit(X_train, y_train)
        metrics = evaluate_model(y_test, idw.predict(X_test))
        results['IDW']['mae'].append(metrics['MAE'])
        results['IDW']['rmse'].append(metrics['RMSE'])
        
        # 3. Kriging
        try:
            krig = KrigingInterpolator(variogram_model='spherical').fit(X_train, y_train)
            metrics = evaluate_model(y_test, krig.predict(X_test))
            results['Kriging']['mae'].append(metrics['MAE'])
            results['Kriging']['rmse'].append(metrics['RMSE'])
        except ImportError:
            print("Skipping Kriging since pykrige is not installed.")
            return

    print("=== Spatial Model Comparison (Week 8) ===")
    for model_name, metrics in results.items():
        if metrics['mae']:
            print(f"{model_name:10s} -> MAE: {np.mean(metrics['mae']):.2f}, RMSE: {np.mean(metrics['rmse']):.2f}")

if __name__ == "__main__":
    run_comparison()
