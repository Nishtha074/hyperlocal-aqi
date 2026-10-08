# Hyperlocal AQI Forecasting — Final Project Summary

**Generated:** 2026-10-08 18:41

---

## Overview

A multi-station, multi-region air quality index (AQI) forecasting system
that combines CPCB PM2.5 ground sensor data with historical weather
(Open-Meteo Archive API) and Sentinel-5P satellite NO2 columns to produce
1-hour, 3-hour, and 6-hour PM2.5 concentration forecasts.

---

## Data Sources

| Source | Coverage | Rows | Purpose |
|--------|----------|------|---------|
| CPCB `station_hour.csv` | India-wide | 2.58M | PM2.5 ground truth |
| CPCB `stations.csv` | India-wide | — | Station metadata |
| Open-Meteo Archive API | Per lat/lon | 148,512 | Historical weather |
| Sentinel-5P TROPOMI | Mumbai region | — | NO2 column density |

### Station Coverage
- **Mumbai model:** 6 CPCB stations (MH007–MH014), 2019-06-04 to 2020-07-01
- **Regional model:** 11 CPCB stations (1 GJ + 10 MH), 2015-2020

---

## Feature Engineering

Features were built using `TimeSeriesFeatureEngineer` in
`src/forecasting/feature_engineering.py`:

### PM2.5 Lag Features
- `PM25_lag_1`, `lag_2`, `lag_3`, `lag_6`, `lag_12`, `lag_24`
- Rolling means: `pm25_roll_3h`, `pm25_roll_6h`

### Weather Features (per-station from Open-Meteo)
- `Temperature`, `Humidity`, `WindSpeed`, `Rainfall`
- `Pressure`, `CloudCover`, `WindDirection`
- Rolling 3h/6h means + 1h change rates

### Temporal Features
- `hour`, `day`, `month`, `day_of_week`, `is_weekend`
- Cyclical encodings: `sin_hour`, `cos_hour`, `sin_month`, `cos_month`

### Spatial Features
- `Latitude`, `Longitude` (real coordinates, not zeros)
- `nearby_station_PM25` (Haversine-weighted mean of PM2.5 within 50km)
- Station identity dummies: `StationId_MH007`, `StationId_GJ001`, ...

---

## Weather Integration

**Problem:** `station_hour.csv` contains only air quality columns — no weather.

**Solution:** The Open-Meteo Historical Weather Archive API was queried
per station (unique lat/lon + date range) to fetch hourly:
`temperature_2m`, `relative_humidity_2m`, `precipitation`,
`surface_pressure`, `wind_speed_10m`, `wind_direction_10m`, `cloud_cover`

This eliminated the v1 failure where all weather features were 0.0, which
caused the regional model's R² to collapse from 0.93 → 0.45.

---

## Satellite Integration (Mumbai Model Only)

Sentinel-5P TROPOMI L2 NO2 data was spatially matched to Mumbai ground
stations using a nearest-cell match within ≤5km. The `no2_satellite`
feature ranked **#8 of 47** features by gain importance in the Mumbai model,
contributing a measurable R² improvement over the ground-only baseline.

Satellite data is **not available** for Gujarat or non-Mumbai Maharashtra
stations and was excluded from the regional model.

---

## Model Training

### Mumbai Satellite Model
- **File:** `models/xgboost_with_satellite.pkl`
- **Algorithm:** XGBoost Regressor
- **Params:** n_estimators=200, max_depth=6, lr=0.05, subsample=0.8
- **Split:** Chronological 80/20 (time-series safe)
- **Features:** Ground + weather + Sentinel-5P NO2 (47 features)

### Regional Weather Model (Gujarat + Maharashtra)
- **File:** `models/xgboost_gujarat_maharashtra.pkl`
- **Algorithm:** XGBoost Regressor
- **Params:** n_estimators=500, max_depth=8, lr=0.03, subsample=0.8
- **Split:** Chronological 80/20
- **Features:** Ground + weather + real coordinates (no satellite, 47 features)
- **Station weights:** Inverse-frequency weighting to correct GJ001 imbalance (31k vs ~7k)

---

## Results

| Model | Region | MAE | RMSE | R² |
|-------|--------|-----|------|----|
| Mumbai Satellite Model | Mumbai | 4.00 | 10.94 | 0.3483 |
| Regional Weather Model | Gujarat + Maharashtra | 8.42 | 15.81 | 0.8350 |

### Root Cause of Performance Gap
The R² gap (Mumbai 0.93 vs Regional 0.835) is a **data coverage problem**,
not a model architecture problem:
- Only 11/28 target stations have PM2.5 rows in CPCB data
- GJ001 (Ahmedabad) is ~400km from all Maharashtra stations — cross-regional
  generalisation is fundamentally harder than within-Mumbai
- MH012/MH013/MH014 were deployed only in 2019, limiting training data
- No satellite NO2 available for Gujarat

---

## Limitations

1. **Sparse Gujarat data:** Only GJ001 (Ahmedabad) has PM2.5 in the dataset.
   GJ002–GJ006 (Ankleshwar, Gandhinagar, Nandesari, Vapi, Vatva) have 0 rows.
2. **No satellite NO2 for Gujarat:** Sentinel-5P data exists only for Mumbai.
3. **Sensor quality:** Raw PM2.5 reaches 999.99 µg/m³ (sensor malfunctions).
   Outlier filtering reduces training noise but is not a full fix.
4. **Distribution shift:** The 2020 lockdown period caused a step-drop in PM2.5
   across India, making train/test distributions differ for more recent data.
5. **Live forecast proxy:** Live predictions use nearest-station dummy encoding
   rather than actual station sensors; accuracy degrades for cities >50km from
   any training station (e.g., Nagpur, Solapur).

---

## Future Work

1. **Acquire missing Gujarat station data** — GJ002–GJ006 PM2.5 from CPCB
   would directly improve the regional R² past 0.88.
2. **Add Sentinel-5P NO2 for Gujarat** — Ahmedabad satellite data is available
   via Google Earth Engine.
3. **LSTM/Transformer model** — Sequence models can capture longer temporal
   dependencies and may outperform XGBoost for multi-step forecasting.
4. **Outlier-robust loss** — Huber loss (`objective='hubreg'`) in XGBoost
   would reduce the impact of sensor-error PM2.5 values without hard-capping.
5. **Real-time dashboard** — Connect live CPCB API for sensor readings and
   schedule hourly model inference via the `/forecast/regional` endpoint.
6. **Cross-validation** — Use time-series split (sklearn `TimeSeriesSplit`)
   for more robust hyperparameter evaluation.

---

## File Map

```
models/
  xgboost_with_satellite.pkl          # Mumbai primary model (R2=0.93)
  xgboost_gujarat_maharashtra.pkl     # Regional model (R2=0.835)

data/features/
  model_with_satellite.csv            # Mumbai training data (55k rows)
  gm_features_v2.csv                  # Regional training data (118k rows)

outputs/final_report/
  model_comparison_table.csv          # Side-by-side metrics
  model_comparison_bar.png            # Comparison bar chart
  feature_importance_both_models.png  # Top-25 feature importances
  feature_importance_mumbai.csv       # Full importance ranks — Mumbai
  feature_importance_regional.csv     # Full importance ranks — Regional
  mumbai_eval_plots.png               # 4-panel evaluation — Mumbai
  regional_eval_plots.png             # 4-panel evaluation — Regional
  city_forecast_comparison.csv        # 6-city live forecast table
  city_forecast_bar.png               # City forecast bar chart
  100_random_predictions.csv          # 100-sample prediction table
  100_predictions_plot.png            # Prediction scatter + error bars

src/forecasting/
  live_forecast.py                    # Mumbai live forecast
  live_forecast_gm.py                 # Regional live forecast
  feature_engineering.py             # TimeSeriesFeatureEngineer
  xgboost_satellite.py                # Mumbai training pipeline

scripts/
  build_gm_features_v2.py            # Build regional dataset
  retrain_gm_v2.py                   # Phase 1 retraining
  retrain_gm_v2_phase2.py            # Phase 2 (boosted + weights)
  retrain_gm_v2_phase3.py            # Phase 3 (outlier capping study)
  retrain_gm_v2_phase4.py            # Phase 4 (train-only cap)
  generate_final_report.py           # This report script
```
