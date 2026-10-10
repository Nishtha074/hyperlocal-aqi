# AirPulse Release Readiness

Last verified: 2026-10-10

## Verdict

The application, FastAPI routes, Streamlit dashboard, and mocked/unit workflow tests run. Release readiness for persisted alerts is **blocked**: the configured PostgreSQL connection was rejected with `InvalidPasswordError` / SQLSTATE `28P01`. No live DB schema inspection, DB initialization, or end-to-end persisted alert workflow could be claimed. The connection URL and credentials were not printed. `.env` is ignored by Git.

## Verified

- FastAPI imports the saved Gujarat/Maharashtra XGBoost model and registers `/api/current`, `/api/station/{station}/history`, `/api/forecast/{station}`, `/api/heatmap`, `/api/risk-assessment`, `/api/model-metrics`, and alert create/list/update/delete/event-history routes.
- `/api/current` returns 503 on DB failure and does not substitute fabricated readings. A mapped station forecast may use an actual timestamped Open-Meteo observation; provider failure returns 503. Unknown stations are rejected rather than assigned another city's observation.
- Live read-only probe: `/api/current` returned the expected generic 503; `/api/forecast/MH009` returned a forecast sourced from Open-Meteo with `is_db_unavailable: true` and the existing XGBoost model.
- Alert request validation rejects unsupported pollutants/operators and negative/non-finite thresholds. DB failures return generic 503 responses without driver details.
- Evaluator unit tests cover comparison boundaries, India AQI derivation from PM2.5, missing/stale/future timestamp rejection, persisted event value/timestamp arguments, disabled alerts, duplicate insert conflict handling, and notification status.
- Schema initialization is mocked twice in tests: all DDL uses `IF NOT EXISTS`, no destructive statement is issued, and connection cleanup occurs. Live idempotence and constraints remain unverified until DB access works.
- FastAPI lifespan starts an evaluator task at startup and shuts it down cleanly. Its default interval is 300 seconds; `ALERT_EVALUATION_INTERVAL_SECONDS` configures it. The evaluator lock prevents overlapping runs in one API process; a unique database index handles duplicate alert/observation event insertion.
- Streamlit starts and renders Home, Forecast, Personal Risk, Model Info, AQI Map, and Alerts. The Alerts tab reports the live API's 503 rather than showing fabricated success or an empty alert list. Forecast/model and risk views rendered during browser inspection.
- Final configured suite: `pytest -q -rs` reports **77 passed, 1 skipped, 1 warning**. The skipped test is `tests/test_week11_lstm.py`, because TensorFlow is not installed. The warning is Starlette's `python_multipart` deprecation notice.

## Architecture and Data Flow

- CPCB readings are collected by `scripts/collect_cpcb.py` from data.gov.in. Weather collection in `scripts/collect_weather.py` currently targets Pune through Open-Meteo.
- `scripts/init_db.py` defines `cpcb_readings`, `weather_readings`, `forecasts`, `model_metrics`, `alerts`, and `alert_events`; alert events have a cascading foreign key and an alert/timestamp unique index.
- FastAPI reads current measurements from PostgreSQL. Forecast can fall back to Open-Meteo for a mapped station when database history is absent and saves successful DB-backed predictions in `forecasts`.
- Streamlit uses IPinfo for approximate viewer location, Open-Meteo for live values, and local forecasting modules/models. Its Alerts tab alone calls FastAPI (`http://localhost:8000/api/alerts`).
- The backend scheduler, not the dashboard, runs alert evaluation. It checks CPCB source `last_update` (timezone-naive values interpreted as Asia/Kolkata), then timestamped Open-Meteo values for mapped locations. It rejects missing, unparseable, stale, unsupported, or future-dated observations outside a five-minute tolerance.

## Locations and Limits

City coordinate mappings in `src/forecasting/live_forecast_gm.py`: Ahmedabad, Ankleshwar, Aurangabad, Chandrapur, Gandhinagar, Kalyan, Mumbai, Nagpur, Nashik, Navi Mumbai, Nandesari, Pune, Solapur, Surat, Thane, Vadodara, Vapi, and Vatva. The explicit station map is MH005-MH014 and GJ001. These are model/location mappings, not proof of current station data coverage. CPCB collection defaults to Pune, Maharashtra. Dashboard city options depend on `data/processed/spatial_station_features.csv`, otherwise Mumbai is the UI fallback.

Forecasts cover PM2.5 at 1h/3h/6h. Displayed ranges are percentage margins, not calibrated prediction intervals. Live API/provider availability and timestamp quality vary. The `last_update` source format has not been checked against a live CPCB database row.

## Alerts and Notifications

- AQI thresholds derive from PM2.5 with the project's India AQI breakpoints for both sources; PM2.5/PM10 compare against reported pollutant values.
- Scheduler: implemented in the FastAPI lifespan; startup and a mocked evaluation cycle were verified. Real scheduled DB evaluation/event persistence remains unverified due SQLSTATE `28P01`.
- Duplicate events: atomic `ON CONFLICT DO NOTHING` plus a unique `(alert_id, observation_timestamp)` index. The index has not been created on the blocked live DB; existing duplicate rows could prevent index creation until reviewed.
- Delete behavior: schema declares `ON DELETE CASCADE`, so deleting an alert deletes its event history. This is defined in DDL, not verified against live PostgreSQL.
- Notifications: no email/SMS adapter exists. No provider configured means `unconfigured`; an arbitrary configured provider means `failed`. The code does not mark an event `sent` without provider confirmation. Real delivery and retries are not operational or verified.

## Environment and Commands

Copy `.env.example` to `.env` and set values locally. Required for DB-backed features: `DATABASE_URL`. CPCB collection additionally requires `DATA_GOV_API_KEY` and `DATA_GOV_RESOURCE_ID`; `CPCB_STATE`/`CPCB_CITY` select the collection filter. Optional alert settings: `ALERT_EVALUATION_INTERVAL_SECONDS` (300) and `ALERT_MAX_OBSERVATION_AGE_MINUTES` (180). Leave `NOTIFICATION_PROVIDER` empty; setting it does not configure delivery. Never put secrets in source control, issue comments, or reports.

Windows PowerShell setup from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install -r backend/requirements.txt
python scripts/init_db.py
```

Run API and dashboard in separate terminals:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
streamlit run dashboard/app.py
```

Run tests with skip reasons:

```powershell
pytest -q -rs
```

## Demonstration Checklist

1. Confirm PostgreSQL credentials out-of-band, initialize the schema, and inspect required tables/indexes.
2. Collect or verify one real timestamped CPCB observation; do not edit a production observation to trigger an alert.
3. Start the API and dashboard. Confirm `/api/current` returns DB readings and `/api/forecast/{station}` identifies its actual source.
4. Create a test alert through the Alerts tab; verify its PostgreSQL row and API list response.
5. In a non-production database, provide a controlled timestamped observation fixture above/below the threshold and allow the scheduler to evaluate it. Verify the event value, source timestamp, and notification status through `/api/alerts/{id}/events`.
6. Repeat evaluation and confirm no duplicate, disable the alert and confirm no further events, then delete it and verify the cascade-retention behavior.
7. Do not demonstrate notification success until a real provider adapter and authorized test recipient have been configured and confirmed.

## Teammate Handover

1. Obtain a working `DATABASE_URL` through the team's approved secret channel; do not send it in chat or commit it. Current blocker: PostgreSQL rejects the configured credential (`28P01`).
2. Run `python scripts/init_db.py`, then verify all six tables, primary/foreign keys, and the unique alert-event index using PostgreSQL metadata. Investigate pre-existing duplicate events if unique-index creation fails.
3. Validate the format/timezone of CPCB `last_update` against a real source row and confirm collection writes use the intended station names.
4. Run `pytest -q -rs`; install TensorFlow if the LSTM test must run. The configured suite is mock/unit-heavy; do not treat it as DB integration.
5. In a non-production DB, complete the demonstration checklist from alert creation through event deletion. Record DB integration separately from unit results.
6. Treat notification delivery as unavailable until an adapter, credentials in a secret manager/environment, retry/idempotency behavior, and an authorized test destination exist. Never claim `sent` from configuration alone.

## Remaining Blockers

- Valid PostgreSQL authentication is needed for live schema inspection, initializer execution, persisted API CRUD, scheduled evaluator/event persistence, and deletion behavior.
- TensorFlow is absent, so the LSTM test is skipped in this environment.
- No real notification provider adapter or authorized recipient is configured.
- data.gov.in CPCB collection authentication and live CPCB timestamp format were not verified in this run.
- External map marker assets were blocked by the integrated browser sandbox; map controls still rendered.