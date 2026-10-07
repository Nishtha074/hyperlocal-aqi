# Hyperlocal Air Quality Forecasting + Personalized Health Risk Alerts

## Problem

Monitoring stations provide pollution measurements only at
specific locations. This makes it difficult to know the
pollution level at locations between monitoring stations.

## Proposed Solution

Our system will combine air-quality observations, weather
information and spatial-temporal machine learning to estimate
and forecast hyperlocal PM2.5 levels.

The system will also estimate prediction uncertainty and
generate personalized health-risk alerts.

## Target

Pollutant: PM2.5
Spatial resolution: 1 km × 1 km
Forecast horizons: 1h, 3h, 6h

## Main Components

1. Data collection
2. Data preprocessing
3. Spatial interpolation
4. PM2.5 forecasting
5. Uncertainty estimation
6. Personalized risk engine
7. Dashboard

## Phase H: Personalized Risk Engine and Alerts

The dashboard now supports a simple, transparent, non-diagnostic personalization layer.

### User profile fields

Users can select:
- Age group: Child, Adult, Older adult
- Activity level: Low, Moderate, High
- Sensitivity category: General, Sensitive, Highly sensitive

The profile is stored in the active Streamlit session and can be updated at any time.

### Personalized threshold and risk logic

The risk engine starts from a base AQI threshold of 100 and adjusts it using profile multipliers:
- Child: 0.92
- Adult: 1.00
- Older adult: 0.88
- Low activity: 1.00
- Moderate activity: 0.90
- High activity: 0.80
- General: 1.00
- Sensitive: 0.85
- Highly sensitive: 0.70

This makes the same AQI produce different risk outcomes for different profiles, while keeping the logic transparent and explainable.

Risk levels are:
- Low
- Moderate
- High
- Very High

This feature is informational only and does not diagnose illness or medical conditions.

### Alerts

The dashboard shows three alert types:
- Current AQI alert: triggers when the live AQI exceeds the personalized threshold.
- Forecast alert: triggers when a forecast point within the next 2 hours crosses the personalized threshold.
- Uncertainty alert: triggers when the existing forecast uncertainty indicates low confidence and an expected range is available.

If all conditions are safe, the UI shows a no-alert message.

### Testing and running

Run the Phase H tests:
- pytest -q tests/test_phase_h_risk_alerts.py

Run the dashboard:
- streamlit run dashboard/app.py

The dashboard requires a compatible Python environment and the project ML dependencies for any forecasting or spatial modules that are enabled in the active environment.
