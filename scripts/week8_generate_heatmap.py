import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import os

from src.spatial.kriging_model import KrigingInterpolator

def generate_heatmap():
    out_dir = 'notebooks/plots'
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'hyperlocal_pollution_heatmap.png')
    
    # 1. Load Station Data
    try:
        df = pd.read_csv('data/processed/spatial_station_features.csv')
        lats = df.get('lat', df.get('Latitude', df.get('latitude', df.get('Lat'))))
        lons = df.get('lon', df.get('Longitude', df.get('longitude', df.get('Lon'))))
        coords = np.column_stack((lats, lons))
        target_col = 'mean_PM25' if 'mean_PM25' in df.columns else ('PM2.5' if 'PM2.5' in df.columns else 'pm25')
        values = df[target_col].values
        print("Loaded actual station data.")
    except FileNotFoundError:
        print("Using synthetic data for heatmap generation.")
        np.random.seed(42)
        lats = np.random.uniform(18.9, 19.3, 15)
        lons = np.random.uniform(72.7, 73.1, 15)
        coords = np.column_stack((lats, lons))
        values = np.random.uniform(30, 80, 15)

    # 2. Fit Kriging Model
    try:
        model = KrigingInterpolator(variogram_model='spherical')
        model.fit(coords, values)
    except ImportError:
        print("Error: PyKrige is required to generate the Kriging heatmap. Please run 'pip install pykrige'.")
        return

    # 3. Create a Grid for Interpolation (1 km x 1 km approx resolution)
    # 1 degree lat/lon is roughly 111 km. So 1 km is ~0.009 degrees.
    grid_lat = np.arange(np.min(lats) - 0.05, np.max(lats) + 0.05, 0.009)
    grid_lon = np.arange(np.min(lons) - 0.05, np.max(lons) + 0.05, 0.009)
    
    grid_lon_mesh, grid_lat_mesh = np.meshgrid(grid_lon, grid_lat)
    flat_grid = np.column_stack((grid_lat_mesh.ravel(), grid_lon_mesh.ravel()))
    
    # 4. Predict over the Grid
    print(f"Predicting over a grid of {len(flat_grid)} points...")
    z_pred = model.predict(flat_grid)
    z_pred_2d = z_pred.reshape(grid_lat_mesh.shape)
    
    # 5. Plot Heatmap
    plt.figure(figsize=(10, 8))
    # contourf for smooth colors
    c = plt.contourf(grid_lon_mesh, grid_lat_mesh, z_pred_2d, levels=20, cmap='YlOrRd')
    plt.colorbar(c, label='PM2.5 Concentration')
    
    # Plot original stations
    plt.scatter(lons, lats, c='black', marker='x', label='Monitoring Stations')
    
    plt.title('Hyperlocal PM2.5 Heatmap (Ordinary Kriging)')
    plt.xlabel('Longitude')
    plt.ylabel('Latitude')
    plt.legend()
    
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    print(f"Heatmap saved to: {out_path}")

if __name__ == "__main__":
    generate_heatmap()
