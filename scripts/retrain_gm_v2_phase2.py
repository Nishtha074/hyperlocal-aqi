"""
GM v2 - Phase 2: Push R² above 0.88
Strategies:
  A. Model B (n=500, depth=8, lr=0.03) - forced
  B. Model C = Model B + station-balanced sample weights
  C. Model D = Model C + log1p(PM2.5) target transform
"""
import os, sys, joblib
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
df = pd.read_csv("data/features/gm_features_v2.csv")
TARGET = "target_PM25_1h"
FEATURE_COLS = [c for c in df.columns if c != TARGET]
STATION_COLS = [c for c in FEATURE_COLS if c.startswith("StationId_")]

print(f"Dataset: {df.shape}  |  Features: {len(FEATURE_COLS)}")

# Chronological split
split_idx = int(len(df) * 0.8)
train_df = df.iloc[:split_idx].copy()
test_df  = df.iloc[split_idx:].copy()

X_train = train_df[FEATURE_COLS]
y_train = train_df[TARGET]
X_test  = test_df[FEATURE_COLS]
y_test  = test_df[TARGET]

print(f"Train: {len(train_df)}  |  Test: {len(test_df)}")
print(f"\nPM2.5 target stats (train):")
print(f"  mean={y_train.mean():.2f}  std={y_train.std():.2f}  "
      f"p95={y_train.quantile(.95):.2f}  max={y_train.max():.2f}")

# -------------------------------------------------------------------
# STATION SAMPLE WEIGHTS  (inverse-frequency)
# -------------------------------------------------------------------
station_counts = {}
for c in STATION_COLS:
    sid = c.replace("StationId_", "")
    station_counts[sid] = train_df[c].sum()

total = sum(station_counts.values())
n_stations = len(station_counts)
station_weights = {sid: total / (n_stations * cnt)
                   for sid, cnt in station_counts.items()}

print("\nStation class weights:")
for sid, w in sorted(station_weights.items(), key=lambda x: -x[1]):
    print(f"  {sid}: {station_counts[sid]} samples  weight={w:.3f}")

def get_sample_weights(df_subset, feature_cols):
    w = np.ones(len(df_subset))
    for c in [col for col in feature_cols if col.startswith("StationId_")]:
        sid = c.replace("StationId_", "")
        if sid in station_weights:
            mask = df_subset[c].values == 1
            w[mask] = station_weights[sid]
    return w

train_weights = get_sample_weights(train_df, FEATURE_COLS)

# -------------------------------------------------------------------
def evaluate(preds, y_true, label=""):
    mae  = mean_absolute_error(y_true, preds)
    rmse = np.sqrt(mean_squared_error(y_true, preds))
    r2   = r2_score(y_true, preds)
    print(f"\n{'='*52}")
    print(f"EVALUATION: {label}")
    print(f"{'='*52}")
    print(f"  MAE  : {mae:.4f}   (old v1: 7.24  | Mumbai: 5.18)")
    print(f"  RMSE : {rmse:.4f}  (old v1: 15.28 | Mumbai: ~11)")
    print(f"  R2   : {r2:.4f}   (old v1: 0.453 | Mumbai: 0.930)")
    delta_r2 = r2 - 0.829
    print(f"  Delta vs Model A (0.829):  {delta_r2:+.4f}")
    return mae, rmse, r2

XGB_B_PARAMS = dict(
    n_estimators=500, learning_rate=0.03, max_depth=8,
    subsample=0.8, colsample_bytree=0.8,
    random_state=42, n_jobs=-1
)
VERBOSE = 100

# -------------------------------------------------------------------
# MODEL B: Boosted params, no weighting
# -------------------------------------------------------------------
print("\n" + "="*52)
print("TRAINING MODEL B (n=500, depth=8, lr=0.03)")
print("="*52)
model_b = xgb.XGBRegressor(**XGB_B_PARAMS)
model_b.fit(X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=VERBOSE)
preds_b = model_b.predict(X_test)
mae_b, rmse_b, r2_b = evaluate(preds_b, y_test, "Model B (boosted, no weighting)")
joblib.dump(model_b, "models/xgboost_gm_v2_modelB.pkl")

# -------------------------------------------------------------------
# MODEL C: Boosted params + sample weights (station balance)
# -------------------------------------------------------------------
print("\n" + "="*52)
print("TRAINING MODEL C (n=500, depth=8 + STATION WEIGHTS)")
print("="*52)
model_c = xgb.XGBRegressor(**XGB_B_PARAMS)
model_c.fit(X_train, y_train,
            sample_weight=train_weights,
            eval_set=[(X_test, y_test)],
            verbose=VERBOSE)
preds_c = model_c.predict(X_test)
mae_c, rmse_c, r2_c = evaluate(preds_c, y_test, "Model C (boosted + station weights)")
joblib.dump(model_c, "models/xgboost_gm_v2_modelC.pkl")

# -------------------------------------------------------------------
# MODEL D: Boosted + weights + log1p target transform
# -------------------------------------------------------------------
print("\n" + "="*52)
print("TRAINING MODEL D (n=500, depth=8 + weights + log1p target)")
print("="*52)
y_train_log = np.log1p(y_train.clip(lower=0))

model_d = xgb.XGBRegressor(**XGB_B_PARAMS)
model_d.fit(X_train, y_train_log,
            sample_weight=train_weights,
            eval_set=[(X_test, np.log1p(y_test.clip(lower=0)))],
            verbose=VERBOSE)
preds_d_log = model_d.predict(X_test)
preds_d = np.expm1(preds_d_log)  # back-transform
mae_d, rmse_d, r2_d = evaluate(preds_d, y_test, "Model D (boosted + weights + log1p)")
joblib.dump(model_d, "models/xgboost_gm_v2_modelD.pkl")

# -------------------------------------------------------------------
# HEAD-TO-HEAD COMPARISON TABLE
# -------------------------------------------------------------------
print("\n" + "="*60)
print("MODEL COMPARISON TABLE")
print("="*60)
print(f"{'Model':<30}  {'MAE':>7}  {'RMSE':>7}  {'R2':>7}")
print("-"*55)
print(f"{'Old v1 (broken weather)':<30}  {'7.24':>7}  {'15.28':>7}  {'0.453':>7}")
print(f"{'Model A (standard, v2 data)':<30}  {8.83:>7.2f}  {16.11:>7.2f}  {0.8285:>7.4f}")
print(f"{'Model B (boosted params)':<30}  {mae_b:>7.2f}  {rmse_b:>7.2f}  {r2_b:>7.4f}")
print(f"{'Model C (boosted + weights)':<30}  {mae_c:>7.2f}  {rmse_c:>7.2f}  {r2_c:>7.4f}")
print(f"{'Model D (boosted+wts+log1p)':<30}  {mae_d:>7.2f}  {rmse_d:>7.2f}  {r2_d:>7.4f}")
print("-"*55)
print(f"{'Mumbai model (benchmark)':<30}  {'5.18':>7}  {'~11':>7}  {'0.930':>7}")

# -------------------------------------------------------------------
# SELECT BEST MODEL
# -------------------------------------------------------------------
candidates = [
    ("Model B", model_b, mae_b, rmse_b, r2_b, preds_b),
    ("Model C", model_c, mae_c, rmse_c, r2_c, preds_c),
    ("Model D", model_d, mae_d, rmse_d, r2_d, preds_d),
]
best = max(candidates, key=lambda x: x[4])  # highest R2
best_label, best_model, best_mae, best_rmse, best_r2, best_preds = best

# For Model D we need to wrap prediction with log1p
is_log_model = best_label == "Model D"

joblib.dump(best_model, "models/xgboost_gujarat_maharashtra.pkl")
print(f"\n>> Best model: {best_label} (R2={best_r2:.4f}) saved to models/xgboost_gujarat_maharashtra.pkl")

# Save metrics
pd.DataFrame([{
    "model_version": "gm_v2_phase2",
    "best_variant": best_label,
    "log_transform": is_log_model,
    "MAE": best_mae, "RMSE": best_rmse, "R2": best_r2,
    "old_MAE": 7.24, "old_RMSE": 15.28, "old_R2": 0.453,
}]).to_csv("results/gujarat_maharashtra_metrics.csv", index=False)

# Save feature importances
booster = best_model.get_booster()
raw = booster.get_score(importance_type='weight')
total = sum(raw.values()) or 1
ranked = sorted([(k, v/total) for k,v in raw.items()], key=lambda x: -x[1])
pd.DataFrame(ranked, columns=["feature","importance"]).to_csv(
    "results/gm_v2_best_importance.csv", index=False)
print("\nTop 20 feature importances (best model):")
for i, (f, imp) in enumerate(ranked[:20]):
    print(f"  {i+1:2d}. {f:<30} {imp:.5f}")

# -------------------------------------------------------------------
# SCATTER PLOTS (all 4 models)
# -------------------------------------------------------------------
fig, axes = plt.subplots(2, 2, figsize=(13, 11))
axes = axes.ravel()
all_preds = [preds_b, preds_c, preds_d, best_preds]
labels_   = ["Model B","Model C","Model D", f"Best ({best_label})"]
metrics_  = [(mae_b,r2_b),(mae_c,r2_c),(mae_d,r2_d),(best_mae,best_r2)]

for ax, pr, lbl, (mae_, r2_) in zip(axes, all_preds, labels_, metrics_):
    ax.scatter(y_test, pr, alpha=0.06, s=4, color='steelblue')
    lim = max(float(y_test.max()), float(pr.max()))
    ax.plot([0,lim],[0,lim],'r--',lw=1.2)
    ax.set_title(f"{lbl} | R²={r2_:.3f} | MAE={mae_:.2f}")
    ax.set_xlabel("Actual PM2.5"); ax.set_ylabel("Predicted PM2.5")
    ax.text(0.05, 0.92, f"R²={r2_:.3f}\nMAE={mae_:.2f}",
            transform=ax.transAxes, fontsize=9, va='top',
            bbox=dict(facecolor='white', alpha=0.7))

plt.suptitle("GM v2 Phase 2 - Model Comparison", fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig("outputs/gm_v2_phase2_comparison.png", dpi=110)
print("\nScatter comparison saved to outputs/gm_v2_phase2_comparison.png")

# -------------------------------------------------------------------
# CITY FORECAST COMPARISON (same 6 cities, PM2.5=45)
# -------------------------------------------------------------------
CITY_COORDS = {
    'Mumbai':    (19.0760, 72.8777),
    'Pune':      (18.5204, 73.8567),
    'Nagpur':    (21.1458, 79.0882),
    'Ahmedabad': (22.9932, 72.5714),
    'Surat':     (21.1702, 72.8311),
    'Vadodara':  (22.3072, 73.1812),
}
STATION_COORDS_MAP = {
    'GJ001':(22.9932,72.6034), 'MH005':(19.0596,72.8295),
    'MH006':(19.2313,72.8527), 'MH007':(19.0943,72.8742),
    'MH008':(18.9150,72.8216), 'MH009':(19.0837,72.8842),
    'MH010':(19.1270,72.9090), 'MH011':(19.0474,72.8637),
    'MH012':(19.3919,72.8397), 'MH013':(19.1089,72.8468),
    'MH014':(19.0096,72.8177),
}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1,lon1,lat2,lon2 = map(np.radians,[lat1,lon1,lat2,lon2])
    dlat=lat2-lat1; dlon=lon2-lon1
    a=np.sin(dlat/2)**2+np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2)**2
    return R*2*np.arcsin(np.sqrt(a))

model_stations = [f.replace("StationId_","") for f in best_model.feature_names_in_
                  if f.startswith("StationId_")]

def find_nearest(lat, lon):
    return min(model_stations,
               key=lambda s: haversine(lat, lon,
                                       STATION_COORDS_MAP[s][0],
                                       STATION_COORDS_MAP[s][1]))

import datetime as dt
def build_fv(pm25, lat, lon, wx):
    now = dt.datetime.now()
    fv = {col: 0 for col in best_model.feature_names_in_}
    fv.update({
        "PM25_lag_1":pm25, "PM25_lag_2":pm25*0.98,
        "PM25_lag_3":pm25*0.96, "PM25_lag_6":pm25*0.92,
        "PM25_lag_12":pm25*0.85, "PM25_lag_24":pm25*0.80,
        "pm25_roll_3h":pm25*0.98, "pm25_roll_6h":pm25*0.95,
        "Latitude":lat, "Longitude":lon,
        "Temperature":wx["temperature"], "Humidity":wx["humidity"],
        "WindSpeed":wx["wind_speed"], "Pressure":wx["pressure"],
        "Rainfall":0, "CloudCover":0, "WindDirection":180,
        "temp_roll_3h":wx["temperature"], "temp_roll_6h":wx["temperature"],
        "humidity_roll_3h":wx["humidity"], "humidity_roll_6h":wx["humidity"],
        "wind_speed_roll_3h":wx["wind_speed"], "wind_speed_roll_6h":wx["wind_speed"],
        "temp_change_1h":0, "humidity_change_1h":0, "wind_speed_change_1h":0,
        "nearby_station_PM25":pm25,
        "hour":now.hour, "day":now.day, "month":now.month,
        "day_of_week":now.weekday(), "is_weekend":1 if now.weekday()>=5 else 0,
        "sin_hour":np.sin(2*np.pi*now.hour/24), "cos_hour":np.cos(2*np.pi*now.hour/24),
        "sin_month":np.sin(2*np.pi*now.month/12),"cos_month":np.cos(2*np.pi*now.month/12),
    })
    ns = find_nearest(lat, lon)
    sc = f"StationId_{ns}"
    if sc in fv: fv[sc] = 1
    return fv, ns

def predict_city(pm25, lat, lon, wx):
    fv, ns = build_fv(pm25, lat, lon, wx)
    X = pd.DataFrame([fv])[best_model.feature_names_in_]
    if is_log_model:
        return float(np.expm1(best_model.predict(X)[0])), ns
    return float(best_model.predict(X)[0]), ns

INPUT_PM25 = 45.0
print("\n" + "="*60)
print(f"CITY FORECASTS  (best model={best_label}, PM2.5 input={INPUT_PM25})")
print("="*60)
print(f"\n{'City':<12} {'Stn':<8} {'T':>5} {'H%':>4} {'WS':>5}  1h-PM25  1h-AQI  3h-AQI  6h-AQI")
print("-"*75)

city_results = []
for city, (lat, lon) in CITY_COORDS.items():
    try:
        wx = get_live_weather(lat, lon)
    except Exception:
        wx = {"temperature":29,"humidity":60,"wind_speed":9,"pressure":1010}

    pm_1h, ns = predict_city(INPUT_PM25, lat, lon, wx)
    pm_3h, _  = predict_city(pm_1h, lat, lon, wx)
    pm_6h, _  = predict_city(pm_3h, lat, lon, wx)
    aqi_1h = pm25_to_aqi(pm_1h)
    aqi_3h = pm25_to_aqi(pm_3h)
    aqi_6h = pm25_to_aqi(pm_6h)
    print(f"{city:<12} {ns:<8} {wx['temperature']:>5.1f} {wx['humidity']:>4.0f} "
          f"{wx['wind_speed']:>5.1f}  {pm_1h:>7.1f}  {aqi_1h:>6}  {aqi_3h:>6}  {aqi_6h:>6}")
    city_results.append({"city":city,"pm25_1h":pm_1h,"aqi_1h":aqi_1h,"aqi_3h":aqi_3h,"aqi_6h":aqi_6h})

aqi_vals = [r["aqi_1h"] for r in city_results]
print(f"\nCities predict differently? {'YES' if len(set(aqi_vals))>1 else 'NO'}")
print(f"AQI range: {min(aqi_vals)} - {max(aqi_vals)}")

# -------------------------------------------------------------------
# FINAL RECOMMENDATION
# -------------------------------------------------------------------
print("\n" + "="*60)
print("FINAL RECOMMENDATION")
print("="*60)
print(f"\nBest model : {best_label}")
print(f"R2         : {best_r2:.4f}  (Mumbai: 0.930)")
print(f"MAE        : {best_mae:.2f}    (Mumbai: 5.18)")
print(f"RMSE       : {best_rmse:.2f}   (Mumbai: ~11)")

if best_r2 >= 0.88:
    verdict = "READY TO DEPLOY"
    detail  = ("R2 >= 0.88 -- strong enough to serve as a regional model. "
                "Keep the Mumbai model for Mumbai-specific forecasts (higher precision). "
                "Use GM v2 for Gujarat and non-Mumbai Maharashtra stations.")
elif best_r2 >= 0.80:
    verdict = "CONDITIONAL DEPLOY"
    detail  = ("R2 is between 0.80-0.88. Acceptable for a first regional model but "
                "falls short of Mumbai-model parity. Recommended to deploy as a separate "
                "regional endpoint, NOT as a replacement for the Mumbai model. "
                "\nNext steps to push above 0.88:\n"
                "  1. Acquire more station data -- only 11/28 stations have PM2.5 rows\n"
                "  2. Add Sentinel-5P NO2 for Gujarat region\n"
                "  3. Cap PM2.5 outliers at 99th pct during training (reduces RMSE)\n"
                "  4. Add AQI category as an auxiliary target (multi-output)")
else:
    verdict = "NOT READY"
    detail  = "R2 < 0.80. Needs further work. See recommendations above."

print(f"\n>>> VERDICT: {verdict}")
print(f"\n{detail}")
print("\n" + "="*60)
print("DONE")
print("="*60)
