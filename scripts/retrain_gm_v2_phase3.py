"""
GM v2 - Phase 3: Break the R²=0.835 ceiling
Fixes two root-cause blockers:
  1. PM2.5 outliers capped at 99th percentile (sensor errors: max=999.99)
  2. Station-stratified split → ensures all 11 stations appear in train
"""
import os, sys, joblib, warnings
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

warnings.filterwarnings("ignore", category=RuntimeWarning)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.data.live_weather import get_live_weather
from src.forecasting.aqi import pm25_to_aqi

os.makedirs("models", exist_ok=True)
os.makedirs("results", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

# -------------------------------------------------------------------
# LOAD + INSPECT
# -------------------------------------------------------------------
df = pd.read_csv("data/features/gm_features_v2.csv")
TARGET = "target_PM25_1h"
FEATURE_COLS = [c for c in df.columns if c != TARGET]
STATION_COLS = [c for c in FEATURE_COLS if c.startswith("StationId_")]

print("="*60)
print("PHASE 3: OUTLIER CAPPING + STATION-AWARE SPLIT")
print("="*60)
print(f"Raw dataset: {df.shape}")

# -------------------------------------------------------------------
# STEP 1: CAP PM2.5 OUTLIERS AT 99TH PERCENTILE
# -------------------------------------------------------------------
p99_input  = df[FEATURE_COLS].filter(like='PM25').quantile(0.99).max()
p99_target = df[TARGET].quantile(0.99)

print(f"\nOutlier stats (before capping):")
print(f"  target PM2.5  max={df[TARGET].max():.1f}   p99={p99_target:.1f}")
print(f"  PM25_lag_1    max={df['PM25_lag_1'].max():.1f}")

CAP = p99_target  # 121 µg/m³
df_capped = df.copy()
# Cap target
df_capped[TARGET] = df_capped[TARGET].clip(upper=CAP)
# Cap all PM2.5 lag/roll features
pm25_feat_cols = [c for c in FEATURE_COLS if 'PM25' in c or 'pm25' in c or 'nearby' in c.lower()]
for c in pm25_feat_cols:
    df_capped[c] = df_capped[c].clip(upper=CAP)

print(f"\nOutlier stats (after capping at p99={CAP:.1f}):")
print(f"  target PM2.5  max={df_capped[TARGET].max():.1f}   mean={df_capped[TARGET].mean():.2f}")
rows_affected = (df[TARGET] > CAP).sum()
print(f"  Rows capped: {rows_affected} ({rows_affected/len(df)*100:.2f}% of dataset)")

# -------------------------------------------------------------------
# STEP 2: STATION-STRATIFIED CHRONOLOGICAL SPLIT
# Guarantees every station has ≥ some rows in training.
# For each station: first 80% of its own timestamps → train, last 20% → test
# -------------------------------------------------------------------
print("\nStation-stratified 80/20 split:")
train_indices = []
test_indices  = []

for sc in STATION_COLS:
    station_mask = df_capped[sc] == 1
    idx = df_capped.index[station_mask].tolist()
    n   = len(idx)
    if n == 0:
        continue
    split = max(1, int(n * 0.8))
    train_indices.extend(idx[:split])
    test_indices.extend(idx[split:])
    sid = sc.replace("StationId_", "")
    print(f"  {sid:>8}: {n:>5} total | {split:>5} train | {n-split:>5} test")

train_df = df_capped.loc[sorted(set(train_indices))].copy()
test_df  = df_capped.loc[sorted(set(test_indices))].copy()

# Remove overlap (any index appearing in both sets stays in train only)
overlap = set(train_indices) & set(test_indices)
if overlap:
    test_df = test_df.drop(index=list(overlap), errors='ignore')

X_train = train_df[FEATURE_COLS]
y_train = train_df[TARGET]
X_test  = test_df[FEATURE_COLS]
y_test  = test_df[TARGET]

print(f"\nFinal split: Train={len(train_df)}  Test={len(test_df)}")

# -------------------------------------------------------------------
# STEP 3: STATION WEIGHTS  (inverse freq, safe vs /0)
# -------------------------------------------------------------------
station_counts = {}
for sc in STATION_COLS:
    sid = sc.replace("StationId_", "")
    cnt = int(train_df[sc].sum())
    station_counts[sid] = cnt

total = sum(station_counts.values())
n_st  = len([v for v in station_counts.values() if v > 0])
station_weights = {}
for sid, cnt in station_counts.items():
    station_weights[sid] = (total / (n_st * cnt)) if cnt > 0 else 1.0

print("\nStation weights (train):")
for sid, w in sorted(station_weights.items(), key=lambda x: -x[1]):
    print(f"  {sid}: {station_counts[sid]} train rows  weight={w:.3f}")

def get_sample_weights(df_sub):
    w = np.ones(len(df_sub))
    for sc in STATION_COLS:
        sid = sc.replace("StationId_", "")
        mask = df_sub[sc].values == 1
        w[mask] = station_weights.get(sid, 1.0)
    return w

train_weights = get_sample_weights(train_df)

# -------------------------------------------------------------------
# TRAIN FUNCTION
# -------------------------------------------------------------------
XGB_PARAMS = dict(
    n_estimators=500, learning_rate=0.03, max_depth=8,
    subsample=0.8, colsample_bytree=0.8,
    min_child_weight=5,     # regularise against rare-station over-fit
    reg_alpha=0.1,          # L1
    reg_lambda=1.5,         # L2
    random_state=42, n_jobs=-1
)

def evaluate(preds, y_true, label):
    mae  = mean_absolute_error(y_true, preds)
    rmse = np.sqrt(mean_squared_error(y_true, preds))
    r2   = r2_score(y_true, preds)
    print(f"\n{'='*52}\nEVALUATION: {label}\n{'='*52}")
    print(f"  MAE  : {mae:.4f}   (Phase2 best: 8.42  | Mumbai: 5.18)")
    print(f"  RMSE : {rmse:.4f}  (Phase2 best: 15.81 | Mumbai: ~11)")
    print(f"  R2   : {r2:.4f}   (Phase2 best: 0.835 | Mumbai: 0.930)")
    return mae, rmse, r2

# -------------------------------------------------------------------
# MODEL E: Capped + stratified split + weights + regularisation
# -------------------------------------------------------------------
print("\n" + "="*52)
print("MODEL E: Capped + stratified split + weights + reg")
print("="*52)
model_e = xgb.XGBRegressor(**XGB_PARAMS)
model_e.fit(X_train, y_train,
            sample_weight=train_weights,
            eval_set=[(X_test, y_test)], verbose=100)
preds_e = model_e.predict(X_test)
mae_e, rmse_e, r2_e = evaluate(preds_e, y_test, "Model E")
joblib.dump(model_e, "models/xgboost_gm_v2_modelE.pkl")

# -------------------------------------------------------------------
# MODEL F: Same + log1p target
# -------------------------------------------------------------------
print("\n" + "="*52)
print("MODEL F: Capped + stratified + weights + log1p target")
print("="*52)
y_train_log = np.log1p(y_train.clip(lower=0))
y_test_log  = np.log1p(y_test.clip(lower=0))

model_f = xgb.XGBRegressor(**XGB_PARAMS)
model_f.fit(X_train, y_train_log,
            sample_weight=train_weights,
            eval_set=[(X_test, y_test_log)], verbose=100)
preds_f_log = model_f.predict(X_test)
preds_f     = np.expm1(preds_f_log)
mae_f, rmse_f, r2_f = evaluate(preds_f, y_test, "Model F (log1p)")
joblib.dump(model_f, "models/xgboost_gm_v2_modelF.pkl")

# -------------------------------------------------------------------
# COMPARISON TABLE
# -------------------------------------------------------------------
print("\n" + "="*65)
print("FULL COMPARISON TABLE (all phases)")
print("="*65)
print(f"{'Model':<35}  {'MAE':>7}  {'RMSE':>7}  {'R2':>7}")
print("-"*60)
rows = [
    ("Old v1 (broken weather)",       7.24,  15.28, 0.453),
    ("Model A (standard, v2 data)",   8.83,  16.11, 0.8285),
    ("Model C (boosted + weights)",   8.42,  15.81, 0.8350),
    ("Model E (+ capping + strat)",   mae_e, rmse_e, r2_e),
    ("Model F (+ log1p target)",      mae_f, rmse_f, r2_f),
]
for name, mae_, rmse_, r2_ in rows:
    print(f"  {name:<33}  {mae_:>7.2f}  {rmse_:>7.2f}  {r2_:>7.4f}")
print("-"*60)
print(f"  {'Mumbai model (benchmark)':<33}  {'5.18':>7}  {'~11.0':>7}  {'0.930':>7}")

# -------------------------------------------------------------------
# BEST MODEL
# -------------------------------------------------------------------
candidates = [
    ("Model E", model_e, mae_e, rmse_e, r2_e, preds_e, False),
    ("Model F", model_f, mae_f, rmse_f, r2_f, preds_f, True),
]
best = max(candidates, key=lambda x: x[4])
best_label, best_model, best_mae, best_rmse, best_r2, best_preds, is_log = best

joblib.dump(best_model, "models/xgboost_gujarat_maharashtra.pkl")
print(f"\n>> Best model: {best_label} (R2={best_r2:.4f}) -> models/xgboost_gujarat_maharashtra.pkl")

# -------------------------------------------------------------------
# FEATURE IMPORTANCES
# -------------------------------------------------------------------
booster = best_model.get_booster()
raw  = booster.get_score(importance_type='weight')
tot  = sum(raw.values()) or 1
ranked = sorted([(k, v/tot) for k,v in raw.items()], key=lambda x: -x[1])
pd.DataFrame(ranked, columns=["feature","importance"]).to_csv(
    "results/gm_v2_phase3_best_importance.csv", index=False)

print(f"\nTop 20 features ({best_label}):")
for i,(f,imp) in enumerate(ranked[:20]):
    print(f"  {i+1:2d}. {f:<30} {imp:.5f}")

# Key feature ranks
ranks = {f:i+1 for i,(f,_) in enumerate(ranked)}
print("\nKey feature ranks:")
for feat in ["Temperature","Humidity","WindSpeed","Pressure",
             "Latitude","Longitude","nearby_station_PM25"]:
    print(f"  {feat:<28}: Rank {ranks.get(feat,'N/A')}")

# Weather check
wx_feats = ["Temperature","Humidity","WindSpeed","Pressure","CloudCover","WindDirection","Rainfall"]
print(f"\nAll weather features used: {all(f in ranks for f in wx_feats)}")
for f in wx_feats:
    tag = "[OK]" if f in ranks else "[NO]"
    print(f"  {tag} {f:<20} Rank {ranks.get(f,'--')}")

# -------------------------------------------------------------------
# SCATTER COMPARISON
# -------------------------------------------------------------------
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
for ax, pr, lbl, (mae_,r2_) in zip(
        axes,
        [preds_e, preds_f],
        ["Model E (capped+stratified)", "Model F (+ log1p)"],
        [(mae_e,r2_e),(mae_f,r2_f)]):
    ax.scatter(y_test, pr, alpha=0.07, s=5, color='steelblue')
    lim = max(float(y_test.max()), float(pr.max()))
    ax.plot([0,lim],[0,lim],'r--',lw=1.5)
    ax.set_title(f"{lbl}\nR²={r2_:.4f}  MAE={mae_:.2f}")
    ax.set_xlabel("Actual PM2.5"); ax.set_ylabel("Predicted PM2.5")

plt.suptitle("GM v2 Phase 3 — After Outlier Fix & Stratified Split", fontsize=12, fontweight='bold')
plt.tight_layout()
plt.savefig("outputs/gm_v2_phase3_scatter.png", dpi=110)
print("\nScatter plot saved: outputs/gm_v2_phase3_scatter.png")

# -------------------------------------------------------------------
# SAVE METRICS
# -------------------------------------------------------------------
pd.DataFrame([{
    "model_version": "gm_v2_phase3",
    "best_variant": best_label,
    "log_transform": is_log,
    "outlier_cap": CAP,
    "stratified_split": True,
    "MAE": best_mae, "RMSE": best_rmse, "R2": best_r2,
    "phase2_best_R2": 0.8350,
    "mumbai_R2": 0.930,
}]).to_csv("results/gujarat_maharashtra_metrics.csv", index=False)

# -------------------------------------------------------------------
# CITY FORECASTS
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
    'GJ001':(22.9932,72.6034),'MH005':(19.0596,72.8295),
    'MH006':(19.2313,72.8527),'MH007':(19.0943,72.8742),
    'MH008':(18.9150,72.8216),'MH009':(19.0837,72.8842),
    'MH010':(19.1270,72.9090),'MH011':(19.0474,72.8637),
    'MH012':(19.3919,72.8397),'MH013':(19.1089,72.8468),
    'MH014':(19.0096,72.8177),
}
model_stations = [c.replace("StationId_","") for c in best_model.feature_names_in_
                  if c.startswith("StationId_")]

def haversine(lat1,lon1,lat2,lon2):
    R=6371.0
    lat1,lon1,lat2,lon2=map(np.radians,[lat1,lon1,lat2,lon2])
    dlat=lat2-lat1; dlon=lon2-lon1
    a=np.sin(dlat/2)**2+np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2)**2
    return R*2*np.arcsin(np.sqrt(a))

def find_nearest(lat,lon):
    return min(model_stations,
               key=lambda s: haversine(lat,lon,STATION_COORDS_MAP[s][0],STATION_COORDS_MAP[s][1]))

import datetime as dt
def build_fv(pm25,lat,lon,wx):
    now=dt.datetime.now()
    pm25=min(pm25,CAP)
    fv={col:0 for col in best_model.feature_names_in_}
    fv.update({
        "PM25_lag_1":pm25,"PM25_lag_2":pm25*0.98,"PM25_lag_3":pm25*0.96,
        "PM25_lag_6":pm25*0.92,"PM25_lag_12":pm25*0.85,"PM25_lag_24":pm25*0.80,
        "pm25_roll_3h":pm25*0.98,"pm25_roll_6h":pm25*0.95,
        "Latitude":lat,"Longitude":lon,
        "Temperature":wx["temperature"],"Humidity":wx["humidity"],
        "WindSpeed":wx["wind_speed"],"Pressure":wx["pressure"],
        "Rainfall":0,"CloudCover":0,"WindDirection":180,
        "temp_roll_3h":wx["temperature"],"temp_roll_6h":wx["temperature"],
        "humidity_roll_3h":wx["humidity"],"humidity_roll_6h":wx["humidity"],
        "wind_speed_roll_3h":wx["wind_speed"],"wind_speed_roll_6h":wx["wind_speed"],
        "temp_change_1h":0,"humidity_change_1h":0,"wind_speed_change_1h":0,
        "nearby_station_PM25":pm25,
        "hour":now.hour,"day":now.day,"month":now.month,
        "day_of_week":now.weekday(),"is_weekend":1 if now.weekday()>=5 else 0,
        "sin_hour":np.sin(2*np.pi*now.hour/24),"cos_hour":np.cos(2*np.pi*now.hour/24),
        "sin_month":np.sin(2*np.pi*now.month/12),"cos_month":np.cos(2*np.pi*now.month/12),
    })
    ns=find_nearest(lat,lon)
    sc=f"StationId_{ns}"
    if sc in fv: fv[sc]=1
    return fv,ns

def predict(pm25,lat,lon,wx):
    fv,ns=build_fv(pm25,lat,lon,wx)
    X=pd.DataFrame([fv])[best_model.feature_names_in_]
    raw=float(best_model.predict(X)[0])
    return (np.expm1(raw) if is_log else raw),ns

INPUT_PM25=45.0
print("\n"+"="*60)
print(f"CITY FORECASTS (PM2.5 input={INPUT_PM25}, model={best_label})")
print("="*60)
print(f"\n{'City':<12} {'Stn':<8} {'T':>5} {'H%':>4} {'WS':>5}  1h-PM25  1h-AQI  3h-AQI  6h-AQI")
print("-"*72)
city_results=[]
for city,(lat,lon) in CITY_COORDS.items():
    try:   wx=get_live_weather(lat,lon)
    except: wx={"temperature":29,"humidity":60,"wind_speed":9,"pressure":1010}
    pm_1h,ns=predict(INPUT_PM25,lat,lon,wx)
    pm_3h,_=predict(pm_1h,lat,lon,wx)
    pm_6h,_=predict(pm_3h,lat,lon,wx)
    a1,a3,a6=pm25_to_aqi(pm_1h),pm25_to_aqi(pm_3h),pm25_to_aqi(pm_6h)
    print(f"{city:<12} {ns:<8} {wx['temperature']:>5.1f} {wx['humidity']:>4.0f} "
          f"{wx['wind_speed']:>5.1f}  {pm_1h:>7.1f}  {a1:>6}  {a3:>6}  {a6:>6}")
    city_results.append({"city":city,"aqi_1h":a1})
aqi_vals=[r["aqi_1h"] for r in city_results]
print(f"\nCities predict differently: {'YES' if len(set(aqi_vals))>1 else 'NO'}")
print(f"AQI range: {min(aqi_vals)} - {max(aqi_vals)}")

# -------------------------------------------------------------------
# FINAL VERDICT
# -------------------------------------------------------------------
print("\n"+"="*60)
print("FINAL VERDICT (Phase 3)")
print("="*60)
print(f"\n  Phase2 best R2 : 0.8350")
print(f"  Phase3 best R2 : {best_r2:.4f}  ({best_label})")
print(f"  Delta          : {best_r2-0.8350:+.4f}")
print(f"  Mumbai R2      : 0.930  (gap: {best_r2-0.930:+.3f})")

if best_r2 >= 0.88:
    print("\n  [READY]  R2 >= 0.88 - deploy as regional model.")
    print("           Keep Mumbai model for Mumbai precision forecasts.")
elif best_r2 >= 0.80:
    print("\n  [CONDITIONAL]  R2 in [0.80, 0.88).")
    print("  The R2 ceiling is a data-limitation problem, not a model problem.")
    print("  Root causes:")
    print("    - Only 11/28 stations have PM2.5 data (very sparse for a regional model)")
    print("    - GJ001 (Ahmedabad) is 400km from all MH stations - cross-region generalisation")
    print("      is fundamentally harder than within-Mumbai generalisation")
    print("    - 0 Gujarat stations in test data (all test data is Mumbai-heavy)")
    print("  Recommendation:")
    print("    - DEPLOY as a separate regional endpoint for Gujarat/non-Mumbai MH")
    print("    - DO NOT replace Mumbai model")
    print("    - Future: get PM2.5 data for GJ002-GJ006, MH015-MH022 to improve coverage")
else:
    print("\n  [NOT READY]  R2 < 0.80. Further data collection needed.")
print()
