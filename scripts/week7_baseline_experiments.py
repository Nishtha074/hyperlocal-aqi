import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pandas as pd
import numpy as np
from src.spatial.baseline_models import NearestNeighborInterpolator, IDWInterpolator, evaluate_model
from sklearn.model_selection import KFold

def run_experiments():
    # Load spatial testing data from week 6 if available
    try:
        df = pd.read_csv('data/processed/spatial_station_features.csv')
        # Assume df has 'latitude', 'longitude', 'PM2.5' columns
        lats = df.get('lat', df.get('Latitude', df.get('latitude', df.get('Lat'))))
        lons = df.get('lon', df.get('Longitude', df.get('longitude', df.get('Lon'))))
        
        coords = np.column_stack((lats, lons))
        target_col = 'mean_PM25' if 'mean_PM25' in df.columns else ('PM2.5' if 'PM2.5' in df.columns else 'pm25')
        values = df[target_col].values
        
    except FileNotFoundError:
        print("Test data fully not available. Generating synthetic data for evaluation.")
        np.random.seed(42)
        lats = np.random.uniform(18.9, 19.3, 20)
        lons = np.random.uniform(72.7, 73.1, 20)
        coords = np.column_stack((lats, lons))
        values = np.random.uniform(30, 80, 20)
        # Adding a spatial pattern
        values += (lats - 18.9) * 50 + (lons - 72.7) * 30

    print(f"Running cross-validation on {len(values)} points...")
    
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    
    nn_mae, nn_rmse = [], []
    idw_mae, idw_rmse = [], []

    for train_idx, test_idx in kf.split(coords):
        X_train, X_test = coords[train_idx], coords[test_idx]
        y_train, y_test = values[train_idx], values[test_idx]
        
        # 1. Nearest Neighbor
        knn = NearestNeighborInterpolator()
        knn.fit(X_train, y_train)
        preds_nn = knn.predict(X_test)
        metrics_nn = evaluate_model(y_test, preds_nn)
        nn_mae.append(metrics_nn['MAE'])
        nn_rmse.append(metrics_nn['RMSE'])
        
        # 2. IDW
        idw = IDWInterpolator(power=2)
        idw.fit(X_train, y_train)
        preds_idw = idw.predict(X_test)
        metrics_idw = evaluate_model(y_test, preds_idw)
        idw_mae.append(metrics_idw['MAE'])
        idw_rmse.append(metrics_idw['RMSE'])

    print("=== Results ===")
    print(f"Nearest Neighbor -> MAE: {np.mean(nn_mae):.2f}, RMSE: {np.mean(nn_rmse):.2f}")
    print(f"IDW (power=2)    -> MAE: {np.mean(idw_mae):.2f}, RMSE: {np.mean(idw_rmse):.2f}")

if __name__ == "__main__":
    run_experiments()
