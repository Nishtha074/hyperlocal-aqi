# Project Status: AirPulse (Hyperlocal AQI)

## 1. Completed and verified
- **Core Models**: The project contains several saved ML models in `models/` including `xgboost_with_satellite.pkl` and `xgboost_gujarat_maharashtra.pkl`.
- **Backend Setup**: The backend has a basic FastAPI structure in `backend/main.py` with routes for `/api/current`, `/api/station/{station}/history`, `/api/forecast/{station}`, `/api/heatmap`, and `/api/risk-assessment`.

## 2. Partially implemented
- **Data Pipeline**: There are multiple Python scripts in `scripts/` (e.g., `collect_cpcb.py`, `collect_weather.py`, `build_gm_features_v2.py`) indicating data collection and feature engineering logic, but reproducibility needs to be verified.
- **Frontend Dashboard (Next.js)**: The `aqi-platform` has detailed UI components (Map, Forecast charts, KPIs, Alerts) but many elements still rely on static or mock data. The integration with the FastAPI backend needs to be solidified.
- **Backend DB integration**: `backend/main.py` tries to fetch from Postgres using `asyncpg` and a `DATABASE_URL`, but falls back to mock data when it fails or when a DB is not running.
- **Model Inference**: The backend endpoints load models like `xgboost_pm25_1h.pkl`, which are not currently matching the saved model filenames (`xgboost_with_satellite.pkl`). Thus, inference falls back to mock percentages (curr * 1.05).

## 3. Not implemented
- **Alert Persistence and Delivery**: The frontend `/alerts` page allows adding alerts to state, but they are not persisted to a database or connected to a real notification system (email/SMS).
- **Proper Inference Features**: The backend `build_features` method in `main.py` uses hardcoded features like `pm25_lag1`, `hour`, `temperature` rather than correctly parsing the model's exact expected feature schemas for Mumbai and Regional models.

## 4. Broken, risky, or requiring validation
- **Backend Model Filenames**: `backend/main.py` attempts to load `xgboost_pm25_1h.pkl` which does not exist in the `models/` folder. This is broken and requires fixing to load the correct `.pkl` files and perform accurate inference.
- **Database Connection**: Hard reliance on a local Postgres database without a graceful setup guide/script or proper error logging.
- **GitHub Actions Workflows**: Need to verify if the `.github/workflows` correctly trigger hourly data ingestion.
