# Week 13: Sentinel-5P Satellite Data Processing Documentation

## Executive Summary
This document records the data ingestion, spatial bounding box clipping, data cleaning, and dataset summary statistics for **Phase F (Week 13): Sentinel-5P Tropospheric NO₂ Satellite Integration** in Mumbai.

---

## 1. Data Source & Product Details
- **Satellite Mission:** Copernicus Sentinel-5 Precursor (Sentinel-5P)
- **Sensor:** TROPOMI (Tropospheric Monitoring Instrument)
- **Product:** Level-3 / Level-2 OFF-LINE (OFFL) Tropospheric NO₂ Column Density (`L3_NO2____`)
- **Target Spatial Domain:** Greater Mumbai Metropolitan Area
- **Temporal Period:** 2019-06-04 to 2020-07-01 (aligned with CPCB ground station dataset)
- **Primary Units:** $\mu\text{mol/m}^2$ (Tropospheric NO₂ vertical column density)

---

## 2. Bounding Box & Spatial Extent
To extract satellite observations covering Mumbai and surrounding urban/industrial corridors, the study domain was clipped using the following exact spatial bounding box:

| Boundary Dimension | Coordinate Value |
|---|---|
| **Min Latitude** | `18.8500 °N` |
| **Max Latitude** | `19.3500 °N` |
| **Min Longitude** | `72.7500 °E` |
| **Max Longitude** | `73.0500 °E` |
| **Spatial Grid Resolution** | `0.04° (~4.4 km grid cell spacing)` |

---

## 3. Data Cleaning & Quality Control Rules

### Cleaning Decisions:
1. **Sentinel Fill Value Filter:** Values equal to Sentinel-5P missing indicator codes (`-9999.0` or `-999.0`) were removed and set to `NaN`.
2. **Physical Boundary Check:** Negative or invalid tropospheric NO₂ column values ($< 0.0\ \mu\text{mol/m}^2$) caused by sensor retrieval noise were flagged and converted to `NaN`.
3. **Cloud Missingness & Quality Filtering:** Cloud-obscured satellite passes during the summer monsoon season (June–September) were identified.
4. **Spatial & Temporal Imputation Strategy:**
   - Missing grid cell values on valid dates were first imputed using the date-level spatial median across the Mumbai bounding box.
   - Global cloudy days were handled using forward-fill followed by backward-fill, ensuring complete spatio-temporal continuity.

---

## 4. Final Dataset Summary Statistics

- **Output File:** [mumbai_satellite_no2.csv](file:///d:/hyperlocal-aqi/data/processed/mumbai_satellite_no2.csv)
- **Total Observations:** 40,976 grid-day rows
- **Schema:** `date`, `latitude`, `longitude`, `no2_satellite`

### Summary Table

| Metric | Value |
|---|---|
| **Total Rows** | 40,976 |
| **Start Date** | `2019-06-04` |
| **End Date** | `2020-07-01` |
| **Min NO₂ Column** | `13.2566 µmol/m²` |
| **Max NO₂ Column** | `226.3027 µmol/m²` |
| **Mean NO₂ Column** | `84.7556 µmol/m²` |
| **Std Dev NO₂ Column** | `35.8462 µmol/m²` |
| **Raw Missing/Invalid %** | `6.10%` |

---

## 5. Visualizations & Outputs
Visual outputs are generated and saved under [outputs/satellite/](file:///d:/hyperlocal-aqi/outputs/satellite/):

1. **Mumbai NO₂ Spatial Map:** Displays spatial variation of tropospheric NO₂ density across latitude/longitude coordinates with CPCB station locations overlaid.
   - Path: `outputs/satellite/mumbai_no2_spatial_map.png`
2. **Mumbai NO₂ Temporal Trend:** Shows annual domain-averaged NO₂ column density across the 2019-2020 study window.
   - Path: `outputs/satellite/mumbai_no2_temporal_trend.png`
