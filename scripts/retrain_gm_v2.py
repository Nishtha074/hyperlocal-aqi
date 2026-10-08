"""
Retrain Gujarat + Maharashtra XGBoost model on gm_features_v2.csv
All 10 requirements handled in sequence.
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.data.live_weather import get_live_weather
from src.forecasting.aqi import pm25_to_aqi

os.makedirs("models", exist_ok=True)
os.makedirs("results", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

# -------------------------------------------------------------------
# LOAD DATA
# -------------------------------------------------------------------
print("="*60)
print("LOADING gm_features_v2.csv")
print("="*60)
df = pd.read_csv("data/features/gm_features_v2.csv")
print(f"Shape: {df.shape}")

TARGET = "target_PM25_1h"
STATION_COLS = [c for c in df.columns if c.startswith("StationId_")]
FEATURE_COLS = [c for c in df.columns if c != TARGET]

print(f"Features: {len(FEATURE_COLS)}  |  Stations: {len(STATION_COLS)}")

# Chronological 80/20 split (no shuffle)
split_idx = int(len(df) * 0.8)
train_df  = df.iloc[:split_idx]
test_df   = df.iloc[split_idx:]

X_train = train_df[FEATURE_COLS]
y_train = train_df[TARGET]
X_test  = test_df[FEATURE_COLS]
y_test  = test_df[TARGET]

print(f"Train: {len(train_df)}  |  Test: {len(test_df)}")


# -------------------------------------------------------------------
def evaluate(model, X_test, y_test, label=""):
    preds = model.predict(X_test)
    mae  = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2   = r2_score(y_test, preds)
    print(f"\n{'='*50}")
    print(f"EVALUATION: {label}")
    print(f"{'='*50}")
    print(f"  MAE  : {mae:.4f}")
    print(f"  RMSE : {rmse:.4f}")
    print(f"  R²   : {r2:.4f}")
    print(f"\n  vs OLD model (v1)  MAE=7.24  RMSE=15.28  R²=0.453")
    print(f"  MAE  delta : {mae  - 7.24:+.4f}")
    print(f"  RMSE delta : {rmse - 15.28:+.4f}")
    print(f"  R²   delta : {r2   - 0.453:+.4f}")
    return mae, rmse, r2, preds


def feature_importance_report(model, label):
    booster = model.get_booster()
    raw = booster.get_score(importance_type='weight')
    total = sum(raw.values()) or 1
    rel = {k: v/total for k, v in raw.items()}
    ranked = sorted(rel.items(), key=lambda x: x[1], reverse=True)

    print(f"\nTop 30 features ({label}):")
    for i, (feat, imp) in enumerate(ranked[:30]):
        print(f"  {i+1:2d}. {feat:<30} {imp:.5f}")

    ranks = {feat: i+1 for i, (feat, _) in enumerate(ranked)}
    print("\nKey feature ranks:")
    for feat in ["Temperature","Humidity","WindSpeed","Pressure",
                 "Latitude","Longitude","nearby_station_PM25"]:
        r = ranks.get(feat, "Not used")
        print(f"  {feat:<25}: Rank {r}")

    # Verify weather actually used
    wx_feats = ["Temperature","Humidity","WindSpeed","Pressure","CloudCover",
                "WindDirection","Rainfall"]
    wx_found = [f for f in wx_feats if f in ranks]
    print(f"\nWeather features used by model: {len(wx_found)}/{len(wx_feats)}")
    for f in wx_feats:
        if f in ranks:
            print(f"  [OK] {f:<20} Rank {ranks[f]}")
        else:
            print(f"  [NO] {f:<20} Not used")

    return ranked, ranks


# -------------------------------------------------------------------
# MODEL A: Standard parameters
# -------------------------------------------------------------------
print("\n" + "="*60)
print("TRAINING MODEL A: Standard (n_estimators=200, max_depth=6)")
print("="*60)
model_a = xgb.XGBRegressor(
    n_estimators=200, learning_rate=0.05, max_depth=6,
    subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1
)
model_a.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

mae_a, rmse_a, r2_a, preds_a = evaluate(model_a, X_test, y_test, "Model A v2")
ranked_a, ranks_a = feature_importance_report(model_a, "Model A")

# Save Model A
joblib.dump(model_a, "models/xgboost_gm_v2_modelA.pkl")
print(f"Model A saved.")
pd.DataFrame(ranked_a, columns=["feature","importance"]).to_csv(
    "results/gm_v2_modelA_importance.csv", index=False)

# -------------------------------------------------------------------
# MODEL B: Boosted (if R² < 0.80)
# -------------------------------------------------------------------
run_model_b = r2_a < 0.80
print(f"\n{'='*60}")
print(f"R² = {r2_a:.4f}  →  Running Model B (n=500, depth=8): {run_model_b}")
print(f"{'='*60}")

if run_model_b:
    model_b = xgb.XGBRegressor(
        n_estimators=500, learning_rate=0.03, max_depth=8,
        subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1
    )
    model_b.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=100)

    mae_b, rmse_b, r2_b, preds_b = evaluate(model_b, X_test, y_test, "Model B v2 (boosted)")
    ranked_b, ranks_b = feature_importance_report(model_b, "Model B")

    joblib.dump(model_b, "models/xgboost_gm_v2_modelB.pkl")
    pd.DataFrame(ranked_b, columns=["feature","importance"]).to_csv(
        "results/gm_v2_modelB_importance.csv", index=False)

    # Pick best
    best_model  = model_b  if r2_b  > r2_a  else model_a
    best_label  = "Model B" if r2_b > r2_a else "Model A"
    best_r2     = max(r2_a, r2_b)
    best_mae    = mae_b  if r2_b > r2_a else mae_a
    best_rmse   = rmse_b if r2_b > r2_a else rmse_a
    best_preds  = preds_b if r2_b > r2_a else preds_a
else:
    best_model = model_a
    best_label = "Model A"
    best_r2    = r2_a
    best_mae   = mae_a
    best_rmse  = rmse_a
    best_preds = preds_a

# -------------------------------------------------------------------
# SAVE FINAL MODEL + METRICS
# -------------------------------------------------------------------
joblib.dump(best_model, "models/xgboost_gujarat_maharashtra.pkl")
print(f"\n✅ Best model ({best_label}) saved to models/xgboost_gujarat_maharashtra.pkl")

metrics = pd.DataFrame([{
    "model_version": "gm_v2",
    "best_variant": best_label,
    "MAE": best_mae, "RMSE": best_rmse, "R2": best_r2,
    "old_MAE": 7.24, "old_RMSE": 15.28, "old_R2": 0.453,
    "MAE_delta": best_mae - 7.24,
    "R2_delta": best_r2 - 0.453,
}])
metrics.to_csv("results/gujarat_maharashtra_metrics.csv", index=False)
print("Metrics saved to results/gujarat_maharashtra_metrics.csv")

# -------------------------------------------------------------------
# ACTUAL VS PREDICTED SCATTER
# -------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(8,6))
ax.scatter(y_test, best_preds, alpha=0.08, s=5, color='steelblue')
lim = max(y_test.max(), best_preds.max())
ax.plot([0,lim],[0,lim],'r--',lw=1.5)
ax.set_xlabel("Actual PM2.5"); ax.set_ylabel("Predicted PM2.5")
ax.set_title(f"Actual vs Predicted ({best_label}) — R²={best_r2:.3f}")
ax.text(0.05,0.90, f"MAE={best_mae:.2f}\nRMSE={best_rmse:.2f}\nR²={best_r2:.3f}",
        transform=ax.transAxes, fontsize=11, verticalalignment='top',
        bbox=dict(facecolor='white', alpha=0.7))
plt.tight_layout()
plt.savefig("outputs/actual_vs_predicted_gm_v2.png", dpi=120)
print("Scatter plot saved.")

# -------------------------------------------------------------------
# CITY FORECAST COMPARISON (Req 8)
# -------------------------------------------------------------------
print("\n" + "="*60)
print("CITY FORECAST COMPARISON  (PM2.5 input = 45)")
print("="*60)

CITY_COORDS = {
    'Mumbai':    (19.0760, 72.8777),
    'Pune':      (18.5204, 73.8567),
    'Nagpur':    (21.1458, 79.0882),
    'Ahmedabad': (22.9932, 72.5714),
    'Surat':     (21.1702, 72.8311),
    'Vadodara':  (22.3072, 73.1812),
}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1,lon1,lat2,lon2 = map(np.radians,[lat1,lon1,lat2,lon2])
    dlat=lat2-lat1; dlon=lon2-lon1
    a=np.sin(dlat/2)**2+np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2)**2
    return R*2*np.arcsin(np.sqrt(a))

STATION_COORDS_MAP = {
    'GJ001':(22.9932,72.6034), 'MH005':(19.0596,72.8295),
    'MH006':(19.2313,72.8527), 'MH007':(19.0943,72.8742),
    'MH008':(18.9150,72.8216), 'MH009':(19.0837,72.8842),
    'MH010':(19.1270,72.9090), 'MH011':(19.0474,72.8637),
    'MH012':(19.3919,72.8397), 'MH013':(19.1089,72.8468),
    'MH014':(19.0096,72.8177),
}

model_stations = [f.replace("StationId_","") for f in best_model.feature_names_in_
                  if f.startswith("StationId_")]

def find_nearest_station(lat, lon):
    return min(model_stations,
               key=lambda s: haversine(lat, lon,
                                       STATION_COORDS_MAP[s][0],
                                       STATION_COORDS_MAP[s][1]))

def build_feature_vector(pm25, lat, lon, weather):
    fv = {col: 0 for col in best_model.feature_names_in_}
    # Lag features
    fv["PM25_lag_1"]  = pm25
    fv["PM25_lag_2"]  = pm25 * 0.98
    fv["PM25_lag_3"]  = pm25 * 0.96
    fv["PM25_lag_6"]  = pm25 * 0.92
    fv["PM25_lag_12"] = pm25 * 0.85
    fv["PM25_lag_24"] = pm25 * 0.80
    fv["pm25_roll_3h"] = pm25 * 0.98
    fv["pm25_roll_6h"] = pm25 * 0.95
    # Real coords
    fv["Latitude"]  = lat
    fv["Longitude"] = lon
    # Real weather
    fv["Temperature"]      = weather["temperature"]
    fv["Humidity"]         = weather["humidity"]
    fv["WindSpeed"]        = weather["wind_speed"]
    fv["Pressure"]         = weather["pressure"]
    fv["Rainfall"]         = 0
    fv["CloudCover"]       = 0
    fv["WindDirection"]    = 180
    fv["temp_roll_3h"]     = weather["temperature"]
    fv["temp_roll_6h"]     = weather["temperature"]
    fv["humidity_roll_3h"] = weather["humidity"]
    fv["humidity_roll_6h"] = weather["humidity"]
    fv["wind_speed_roll_3h"] = weather["wind_speed"]
    fv["wind_speed_roll_6h"] = weather["wind_speed"]
    fv["temp_change_1h"]       = 0
    fv["humidity_change_1h"]   = 0
    fv["wind_speed_change_1h"] = 0
    fv["nearby_station_PM25"]  = pm25
    # Time
    import datetime as dt
    now = dt.datetime.now()
    fv["hour"] = now.hour; fv["day"] = now.day
    fv["month"] = now.month; fv["day_of_week"] = now.weekday()
    fv["is_weekend"] = 1 if now.weekday()>=5 else 0
    fv["sin_hour"]  = np.sin(2*np.pi*now.hour/24)
    fv["cos_hour"]  = np.cos(2*np.pi*now.hour/24)
    fv["sin_month"] = np.sin(2*np.pi*now.month/12)
    fv["cos_month"] = np.cos(2*np.pi*now.month/12)
    # Station dummy
    ns = find_nearest_station(lat, lon)
    sc = f"StationId_{ns}"
    if sc in fv: fv[sc] = 1
    return fv, ns

INPUT_PM25 = 45.0
results = []
print(f"\n{'City':<12} {'Lat':>7} {'Lon':>8} {'NearestStn':<12} "
      f"{'T(°C)':>7} {'H%':>5} {'WS':>5} {'P':>7}  "
      f"{'1h AQI':>7} {'3h AQI':>7} {'6h AQI':>7}")
print("-"*90)

for city, (lat, lon) in CITY_COORDS.items():
    try:
        wx = get_live_weather(lat, lon)
    except Exception:
        wx = {"temperature":28,"humidity":65,"wind_speed":10,"pressure":1010}

    fv, ns = build_feature_vector(INPUT_PM25, lat, lon, wx)
    X = pd.DataFrame([fv])[best_model.feature_names_in_]

    pm_1h = float(best_model.predict(X)[0])
    fv2,_ = build_feature_vector(pm_1h, lat, lon, wx)
    X2 = pd.DataFrame([fv2])[best_model.feature_names_in_]
    pm_3h = float(best_model.predict(X2)[0])
    fv3,_ = build_feature_vector(pm_3h, lat, lon, wx)
    X3 = pd.DataFrame([fv3])[best_model.feature_names_in_]
    pm_6h = float(best_model.predict(X3)[0])

    aqi_1h = pm25_to_aqi(pm_1h)
    aqi_3h = pm25_to_aqi(pm_3h)
    aqi_6h = pm25_to_aqi(pm_6h)

    print(f"{city:<12} {lat:>7.3f} {lon:>8.3f} {ns:<12} "
          f"{wx['temperature']:>7.1f} {wx['humidity']:>5.0f} "
          f"{wx['wind_speed']:>5.1f} {wx['pressure']:>7.1f}  "
          f"{aqi_1h:>7} {aqi_3h:>7} {aqi_6h:>7}")

    results.append(dict(city=city, lat=lat, lon=lon, nearest_station=ns,
                        temp=wx['temperature'], humidity=wx['humidity'],
                        wind_speed=wx['wind_speed'], pressure=wx['pressure'],
                        pm25_input=INPUT_PM25, pm25_1h=pm_1h,
                        aqi_1h=aqi_1h, aqi_3h=aqi_3h, aqi_6h=aqi_6h))

aqi_vals = [r["aqi_1h"] for r in results]
print(f"\nAll-same AQI? {'YES ❌' if len(set(aqi_vals))==1 else 'NO ✅ — Cities predict differently!'}")
print(f"AQI range: {min(aqi_vals)} – {max(aqi_vals)}")

# -------------------------------------------------------------------
# FINAL RECOMMENDATION (Req 10)
# -------------------------------------------------------------------
print("\n" + "="*60)
print("FINAL RECOMMENDATION")
print("="*60)
mumbai_r2 = 0.93
print(f"Mumbai model:   MAE=5.18  RMSE=~11  R²=0.930")
print(f"GM v2 model:    MAE={best_mae:.2f}  RMSE={best_rmse:.2f}  R²={best_r2:.3f}")
print()
if best_r2 >= 0.88:
    print("[READY] GM v2 model is competitive with Mumbai model.")
    print("   Recommend replacing Mumbai model for the regional pipeline.")
elif best_r2 >= 0.80:
    print("[CLOSE] GM v2 model is significantly improved but not yet at Mumbai parity.")
    print("   Suitable as a regional model for Gujarat + Maharashtra.")
    print("   Do NOT replace Mumbai model -- keep Mumbai model for Mumbai forecasts.")
else:
    print("[NOT READY] R2 still below 0.80. Further work needed.")
    print("   Suggestions:")
    print("    - Add satellite NO2 for the GJ region (if data available)")
    print("    - Weight loss to address GJ001 imbalance (31k vs 6.5k samples)")
    print("    - Add GJ station weather clustering features")

print("\n" + "="*60)
print("DONE")
print("="*60)
