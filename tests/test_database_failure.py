import asyncio
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from scripts.init_db import init_db

client = TestClient(app)

@pytest.fixture
def unavailable_main_database(monkeypatch):
    async def fail_connection():
        raise OSError("simulated database outage")

    monkeypatch.setattr("backend.main.get_conn", fail_connection)


def test_api_current_database_unavailable(unavailable_main_database):
    response = client.get("/api/current")
    assert response.status_code == 503
    assert "Database unavailable" in response.json()["detail"]
    assert "password" not in response.text.lower()

@patch("backend.main.predict_pm25", side_effect=[60.0, 65.0, 70.0])
@patch("backend.main.get_live_aqi", return_value={"pm25": 42.5, "timestamp": "2026-10-10T12:00:00"})
def test_api_forecast_database_unavailable_uses_open_meteo(mock_live_aqi, mock_predict, unavailable_main_database):
    response = client.get("/api/forecast/MH009")
    assert response.status_code == 200
    data = response.json()
    assert data["is_db_unavailable"] is True
    assert data["is_demo_fallback"] is False
    assert "Open-Meteo" in data["note"]
    assert "forecast" in data
    assert "1h" in data["forecast"]
    assert "value" in data["forecast"]["1h"]
    assert data["current_pm25"] == 42.5
    assert "Database unavailable" in data["note"]
    mock_live_aqi.assert_called_once()


def test_api_forecast_empty_history_marks_database_available():
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    mock_conn.fetchval.return_value = None

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi", return_value={"pm25": 42.5}):
            with patch("backend.main.predict_pm25", side_effect=[60.0, 65.0, 70.0]):
                response = client.get("/api/forecast/MH009")

    data = response.json()
    assert response.status_code == 200
    assert data["is_db_unavailable"] is False
    assert data["is_demo_fallback"] is False
    assert data["note"] == "No stored history for this station; observation sourced from Open-Meteo. Forecast generated using XGBoost model."
    mock_conn.close.assert_awaited_once()


def test_api_forecast_database_query_failure_keeps_unavailable_status():
    mock_conn = AsyncMock()
    mock_conn.fetch.side_effect = RuntimeError("simulated query failure")

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi", return_value={"pm25": 42.5}):
            with patch("backend.main.predict_pm25", side_effect=[60.0, 65.0, 70.0]):
                response = client.get("/api/forecast/MH009")

    data = response.json()
    assert response.status_code == 200
    assert data["is_db_unavailable"] is True
    assert data["is_demo_fallback"] is False
    assert "Database unavailable" in data["note"]


@patch("backend.main.get_live_aqi", side_effect=ConnectionError("simulated API outage"))
def test_api_forecast_external_failure_does_not_return_fabricated_data(mock_live_aqi, unavailable_main_database):
    response = client.get("/api/forecast/MH009")

    assert response.status_code == 503
    assert "fallback API failed" in response.json()["detail"]
    mock_live_aqi.assert_called_once()


@patch("backend.main.get_live_aqi")
def test_unknown_station_does_not_use_mumbai_fallback(mock_live_aqi, unavailable_main_database):
    response = client.get("/api/forecast/UNKNOWN-STATION")

    assert response.status_code == 404
    assert "No supported location mapping" in response.json()["detail"]
    mock_live_aqi.assert_not_called()


def test_init_db_can_run_twice_without_destructive_sql():
    mock_conn = AsyncMock()
    with patch("scripts.init_db.DB_URL", "postgresql://unit-test"), patch(
        "scripts.init_db.asyncpg.connect", new=AsyncMock(return_value=mock_conn)
    ):
        asyncio.run(init_db())
        asyncio.run(init_db())

    statements = [call.args[0] for call in mock_conn.execute.call_args_list]
    assert len(statements) == 14
    assert all("CREATE TABLE IF NOT EXISTS" in sql or "CREATE UNIQUE INDEX IF NOT EXISTS" in sql for sql in statements)
    assert not any(sql.lstrip().upper().startswith(("DROP ", "DELETE ", "TRUNCATE ")) for sql in statements)
    schema = "\n".join(statements)
    for table in ("cpcb_readings", "weather_readings", "forecasts", "model_metrics", "alerts", "alert_events"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in schema
    assert "REFERENCES alerts(id) ON DELETE CASCADE" in schema
    assert "CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_events_alert_observation" in schema
    assert "ON alert_events (alert_id, observation_timestamp)" in schema
    assert mock_conn.close.await_count == 2


def test_init_db_fails_explicitly_when_database_is_unconfigured():
    with patch("scripts.init_db.DB_URL", None):
        with pytest.raises(RuntimeError, match="DATABASE_URL is not configured"):
            asyncio.run(init_db())
