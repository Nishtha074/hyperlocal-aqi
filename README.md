# AirPulse

AirPulse combines live air-quality observations, saved PM2.5 forecasting models, a FastAPI service, and a Streamlit dashboard. The current release is a research/demo system: database-backed alerts require PostgreSQL, and notification delivery is not implemented.

## Architecture and Data Flow

- `scripts/collect_cpcb.py` fetches CPCB station data from data.gov.in and appends it to PostgreSQL. `scripts/collect_weather.py` collects Open-Meteo weather for Pune.
- `scripts/init_db.py` creates `cpcb_readings`, `weather_readings`, `forecasts`, `model_metrics`, `alerts`, and `alert_events`. It uses `CREATE ... IF NOT EXISTS`, preserves existing rows, and adds a unique alert/observation index for duplicate-event prevention.
- `backend/main.py` serves current readings, station history, forecasts, risk, heatmap, model metrics, and alert APIs. Current observations come from PostgreSQL only. The forecast endpoint may use a timestamped Open-Meteo observation when the DB has no history for a mapped station; unknown stations are rejected rather than assigned another city's observation.
- `backend/routes_alerts.py` provides alert create/list/update/delete and event history. Alert events are removed when their alert is deleted (`ON DELETE CASCADE`).
- `backend/alert_evaluator.py` reads enabled alerts and the latest CPCB source timestamp (`last_update`); if no CPCB PM measurement exists, it can request a timestamped Open-Meteo value for a mapped location. AQI alerts derive India AQI from PM2.5 using the project's conversion helper for either source. Missing, unparseable, stale, or unsupported observations are skipped. Events are inserted atomically and are unique by alert and observation timestamp.
- `dashboard/app.py` gets the viewer's approximate location through IPinfo, live AQI/weather-related values through Open-Meteo, and forecast values from local model code. Its Alerts tab calls the FastAPI service at `http://localhost:8000`; the dashboard must not be used as the alert scheduler.

## Setup (Windows PowerShell)

Requirements: Python 3.10+ (Python 3.11 was used for this verification), PostgreSQL, and network access to the enabled data providers.

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install -r backend/requirements.txt
```

Edit `.env` locally. Set a valid PostgreSQL URL and, if collecting CPCB data, `DATA_GOV_API_KEY` and `DATA_GOV_RESOURCE_ID`. Never commit `.env` or paste its values into logs or reports. `.env.example` contains placeholders, not working credentials.

Environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string; required for schema initialization, persisted alerts, readings, and DB-backed API responses. |
| `DATA_GOV_API_KEY` | data.gov.in CPCB collection credential. |
| `DATA_GOV_RESOURCE_ID` | data.gov.in CPCB resource identifier. |
| `CPCB_STATE`, `CPCB_CITY` | CPCB collection filters; defaults in the script are Maharashtra and Pune. |
| `ALERT_EVALUATION_INTERVAL_SECONDS` | Backend scheduler interval; defaults to 300 seconds and must be positive. |
| `ALERT_MAX_OBSERVATION_AGE_MINUTES` | Maximum observation age accepted by the alert evaluator; defaults to 180 minutes. |
| `NOTIFICATION_PROVIDER` | No provider adapter exists. Leave empty; setting a name does not enable delivery and produces a failed notification status. |

## Initialize and Run

Initialize or safely rerun the schema after configuring PostgreSQL:

```powershell
python scripts/init_db.py
```

Start the API and dashboard in separate terminals from the repository root:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

```powershell
streamlit run dashboard/app.py
```

The API docs are at `http://127.0.0.1:8000/docs`; Streamlit prints its local URL (normally `http://localhost:8501`). The API lifespan starts alert evaluation immediately, then repeats on the configured interval. Alerts therefore do not depend on Streamlit remaining open, but do depend on the API process and PostgreSQL being available.

Data collection commands, when provider credentials and PostgreSQL are ready:

```powershell
python scripts/collect_cpcb.py
python scripts/collect_weather.py
```

## Test

```powershell
pytest -q -rs
```

The test suite includes unit and TestClient coverage using mocks. These tests do not establish real PostgreSQL connectivity or real notification delivery. Root-level `test_*.py` files are mostly manual diagnostic scripts, not pytest tests. One configured LSTM test is skipped when TensorFlow is unavailable.

## Locations and Model Scope

The spatial forecasting code defines approximate city coordinates for Ahmedabad, Ankleshwar, Aurangabad, Chandrapur, Gandhinagar, Kalyan, Mumbai, Nagpur, Nashik, Navi Mumbai, Nandesari, Pune, Solapur, Surat, Thane, Vadodara, Vapi, and Vatva. The explicit station-to-city fallback map currently includes MH005-MH014 and GJ001. This is a model mapping, not a guarantee that every station currently has a fresh CPCB reading. CPCB collection defaults to Pune, Maharashtra; the dashboard's selectable city list depends on `data/processed/spatial_station_features.csv` and falls back to Mumbai when that file has no cities.

## Limitations and Release State

- Current API measurements are database-backed and return 503 when the query/connection fails; they are not replaced with demo measurements.
- Forecasting is for PM2.5 at 1h, 3h, and 6h. The API's displayed ranges use a percentage margin and are not calibrated confidence intervals. A fallback forecast is only available for a mapped location and a successful live Open-Meteo observation.
- Alert comparison supports `pm25`, `pm10`, and `aqi`, and operators `>`, `>=`, `<`, and `<=`. AQI is derived from PM2.5 using the project's India AQI breakpoints. A real, fresh, timestamped observation is required. CPCB `last_update` is interpreted as Asia/Kolkata when timezone-naive; confirm source formatting with live CPCB data before relying on scheduled alerts.
- The API scheduler is implemented and tested at startup with a mocked evaluator. Real scheduled persistence has not been verified because the configured PostgreSQL connection currently fails authentication (SQLSTATE `28P01`).
- No email/SMS provider adapter is implemented. Missing provider configuration records `unconfigured`; a configured but unsupported provider records `failed`. No notification is represented as sent without provider confirmation.
- IPinfo, Open-Meteo, data.gov.in, PostgreSQL, and external map tiles are separate runtime dependencies. The map can render with external marker assets blocked by restrictive browser/network environments.

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the verification record and teammate handover.