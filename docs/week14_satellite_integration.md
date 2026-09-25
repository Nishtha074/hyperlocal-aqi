# Week 14: Ground + Satellite Data Integration & Model Evaluation Documentation

## Executive Summary
This document provides the complete methodology, spatio-temporal integration strategy, model retraining pipeline, comparative metric evaluations, and feature importance analysis for **Phase F (Week 14): Satellite Data Integration for Hyperlocal PM2.5 Forecasting in Mumbai**.

---

## 1. Integration & Merging Strategy

### Datasets Integrated:
1. **Ground Monitoring Dataset:** [mumbai_feature_engineered.csv](file:///d:/hyperlocal-aqi/data/processed/mumbai_feature_engineered.csv) (55,446 hourly records across 6 CPCB monitoring stations).
2. **Sentinel-5P Satellite NO₂ Dataset:** [mumbai_satellite_no2.csv](file:///d:/hyperlocal-aqi/data/processed/mumbai_satellite_no2.csv) (40,976 daily gridded observation records).

### Spatio-Temporal Matching Strategy:
- **Temporal Alignment:** Aligned on a daily date key (`date_key` extracted from `Datetime`).
- **Spatial Nearest-Neighbor Matching:** For each CPCB station's spatial coordinates $(Lat_{station}, Lon_{station})$ on date $D$, a 2D spatial `KDTree` query was executed against the Sentinel-5P grid cell coordinates on date $D$.
- **Mean Spatial Proximity:** Average matching distance between CPCB stations and nearest satellite grid cells was **1.57 km**.

### Final Feature Set Dataset:
- Saved to: [model_with_satellite.csv](file:///d:/hyperlocal-aqi/data/features/model_with_satellite.csv)
- Total Features ($X$): 46 (45 ground features + 1 satellite feature: `no2_satellite`)
- Target ($y$): `target_PM25_1h` (1-hour ahead PM2.5 concentration)

---

## 2. Experimental Setup & Model Configuration

Both models were trained using XGBoost Regressor with identical hyperparameter configurations and strict 80/20 chronological train/test splitting to prevent data leakage.

- **Split Ratio:** Chronological 80% Train / 20% Test
- **Train Range:** 2019-06-04 10:00:00 to 2020-04-14 17:00:00 (40,540 samples)
- **Test Range:** 2020-04-14 18:00:00 to 2020-07-01 00:00:00 (10,136 samples)
- **XGBoost Hyperparameters:** `n_estimators=200`, `learning_rate=0.05`, `max_depth=6`, `subsample=0.8`, `colsample_bytree=0.8`, `random_state=42`.

---

## 3. Comparative Metric Evaluation Table

| Evaluation Metric | Baseline Model A (Ground Only) | Model B (With Satellite NO₂) | Improvement (%) |
|---|---|---|---|
| **MAE (µg/m³)** | `4.2530` | `4.0010` | **+5.92%** |
| **RMSE (µg/m³)** | `11.2970` | `10.9370` | **+3.19%** |
| **R² Score** | `0.3047` | `0.3483` | **+14.31%** |

*Note: Positive percentage values indicate performance improvements (reduction in error, increase in R²).*

---

## 4. XGBoost Feature Importance Analysis

In Model B, feature importances were extracted using feature gain scores across all trees.

- **Rank of `no2_satellite`:** **#4 out of 46 features**
- **Importance Score:** `0.01551`

### Top 10 Features in Satellite XGBoost:

| Rank | Feature Name | Feature Type | Importance Score |
|---|---|---|---|
| **1** | `PM2.5` | Ground PM2.5 Lag 0 | 0.5281 |
| **2** | `nearby_station_PM25` | Spatial Ground Neighbor | 0.1764 |
| **3** | `PM25_lag_1` | Ground PM2.5 Lag 1h | 0.0331 |
| **4** | **`no2_satellite`** | **Sentinel-5P Satellite NO₂** | **0.0155** |
| **5** | `Temperature` | Weather Feature | 0.0150 |
| **6** | `pm25_roll_6h` | Ground Rolling Mean | 0.0137 |
| **7** | `cos_hour` | Temporal Encoding | 0.0121 |
| **8** | `pm25_roll_3h` | Ground Rolling Mean | 0.0119 |
| **9** | `PM25_lag_6` | Ground PM2.5 Lag 6h | 0.0109 |
| **10** | `PM25_lag_12` | Ground PM2.5 Lag 12h | 0.0106 |

---

## 5. Scientific Discussion & Conclusion

1. **Impact of Satellite NO₂:** Integrating Sentinel-5P tropospheric NO₂ into the ground XGBoost model resulted in consistent performance gains across all three regression metrics (MAE improved by **5.92%**, RMSE by **3.19%**, and R² increased by **14.31%**).
2. **Feature Ranking:** `no2_satellite` ranked as the **4th most important feature** in the model, outperforming traditional meteorology inputs like Temperature, Humidity, and Wind Speed. This demonstrates that satellite atmospheric NO₂ serves as an effective spatial proxy for urban combustion activity and regional boundary layer pollution dynamics in Mumbai.
3. **Reproducibility:** All processing steps, data splits, and model artifacts are saved and fully reproducible via `scripts/week14_satellite_integration.py`.
