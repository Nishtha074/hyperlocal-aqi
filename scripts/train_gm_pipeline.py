import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
import sys

# Ensure src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.forecasting.feature_engineering import TimeSeriesFeatureEngineer

os.makedirs("data/features", exist_ok=True)
os.makedirs("models", exist_ok=True)
os.makedirs("results", exist_ok=True)

# 1. Identify MH and GJ stations
print("Loading stations metadata...")
stations_df = pd.read_csv("data/raw/india_air_quality/stations.csv")
mh_gj_stations = stations_df[stations_df['State'].isin(['Maharashtra', 'Gujarat'])]
valid_station_ids = mh_gj_stations['StationId'].tolist()

num_mh = sum(mh_gj_stations['State'] == 'Maharashtra')
num_gj = sum(mh_gj_stations['State'] == 'Gujarat')

print(f"Number of Maharashtra stations: {num_mh}")
print(f"Number of Gujarat stations: {num_gj}")
print(f"Total eligible stations: {len(valid_station_ids)}")

# 2. Build Dataset
print("Loading station hour data...")
df = pd.read_csv("data/raw/india_air_quality/station_hour.csv", usecols=['StationId', 'Datetime', 'PM2.5'])
df = df[df['StationId'].isin(valid_station_ids)]
df = df.dropna(subset=['PM2.5'])

print(f"Filtered dataset shape: {df.shape}")

# Provide dummy Lat/Lon for feature engineer
df["Latitude"] = 0.0
df["Longitude"] = 0.0

# 3. Generate Features
print("Running Feature Engineering...")
engineer = TimeSeriesFeatureEngineer(nearby_radius_km=10.0)
df_features = engineer.run_all(df)

df_features["no2_satellite"] = 0.0
df_features["Pressure"] = 0.0
df_features["CloudCover"] = 0.0
df_features["WindDirection"] = 0.0
df_features["pm25_roll_6h"] = df_features.groupby("StationId")["PM2.5"].transform(lambda x: x.shift(1).rolling(window=6, min_periods=1).mean())
df_features["temp_roll_6h"] = df_features.groupby("StationId")["Temperature"].transform(lambda x: x.shift(1).rolling(window=6, min_periods=1).mean())
df_features["humidity_roll_6h"] = df_features.groupby("StationId")["Humidity"].transform(lambda x: x.shift(1).rolling(window=6, min_periods=1).mean())
df_features["wind_speed_roll_6h"] = df_features.groupby("StationId")["WindSpeed"].transform(lambda x: x.shift(1).rolling(window=6, min_periods=1).mean())

feature_cols = [
    "PM25_lag_1", "PM25_lag_2", "PM25_lag_3", "PM25_lag_6", "PM25_lag_12", "PM25_lag_24",
    "pm25_roll_3h", "pm25_roll_6h",
    "Temperature", "Humidity", "WindSpeed", "Rainfall", "Pressure", "CloudCover", "WindDirection",
    "temp_roll_3h", "temp_roll_6h", "humidity_roll_3h", "humidity_roll_6h",
    "wind_speed_roll_3h", "wind_speed_roll_6h",
    "temp_change_1h", "humidity_change_1h", "wind_speed_change_1h",
    "hour", "day", "month", "day_of_week", "is_weekend",
    "sin_hour", "cos_hour", "sin_month", "cos_month",
    "Latitude", "Longitude", "nearby_station_PM25", "no2_satellite"
]

target_col = "target_PM25_1h"

for c in feature_cols:
    if c not in df_features.columns:
        df_features[c] = 0.0

# Drop NaNs
df_ready = df_features.dropna(subset=feature_cols + [target_col])
print(f"Dataset after dropping NaNs: {df_ready.shape}")

# 4. Station Encoding
print("Encoding stations...")
df_ready = pd.get_dummies(df_ready, columns=["StationId"], drop_first=False)
for col in df_ready.columns:
    if col.startswith('StationId_'):
        df_ready[col] = df_ready[col].astype(int)

final_feature_cols = feature_cols + [c for c in df_ready.columns if c.startswith('StationId_')]

# Save features
df_ready[final_feature_cols + [target_col]].to_csv("data/features/gujarat_maharashtra_features.csv", index=False)

# Sort by Datetime for chronological split
df_ready = df_ready.sort_values(by="Datetime").reset_index(drop=True)

# 5. Train New Model
print("Splitting train/test...")
split_idx = int(len(df_ready) * 0.8)
train_df = df_ready.iloc[:split_idx]
test_df = df_ready.iloc[split_idx:]

X_train = train_df[final_feature_cols]
y_train = train_df[target_col]
X_test = test_df[final_feature_cols]
y_test = test_df[target_col]

print(f"X_train shape: {X_train.shape}, X_test shape: {X_test.shape}")

print("Training model...")
model = xgb.XGBRegressor(
    n_estimators=200,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# Save model
joblib.dump(model, "models/xgboost_gujarat_maharashtra.pkl")

# 6. Evaluate
preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
rmse = np.sqrt(mean_squared_error(y_test, preds))
r2 = r2_score(y_test, preds)

print(f"Test MAE: {mae:.4f}")
print(f"Test RMSE: {rmse:.4f}")
print(f"Test R2: {r2:.4f}")

# Results summary
num_stations_used = len([c for c in final_feature_cols if c.startswith('StationId_')])
res_df = pd.DataFrame([{
    "MAE": mae,
    "RMSE": rmse,
    "R2": r2,
    "num_stations_used": num_stations_used,
    "num_samples": len(df_ready),
    "num_mh_stations": num_mh,
    "num_gj_stations": num_gj
}])
res_df.to_csv("results/gujarat_maharashtra_metrics.csv", index=False)

print("Pipeline completed successfully.")
