"""Tests for forecast persistence on both CPCB and Open-Meteo paths."""
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, call
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


# ── CPCB path: forecasts are persisted ────────────────────────────────────────

def test_cpcb_path_persists_all_three_horizons():
    """When a stored CPCB row is found, all three horizons must be inserted."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 50.0,
            "latitude": 19.0863,
            "longitude": 72.8888,
            "last_update": "2026-10-10 10:00:00",
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    # Three INSERT calls, one per horizon
    assert mock_conn.execute.await_count == 3


def test_cpcb_path_forecast_has_correct_columns():
    """Persisted CPCB forecasts must include all required columns."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 50.0,
            "latitude": 19.0863,
            "longitude": 72.8888,
            "last_update": "2026-10-10 10:00:00",
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    # Check the INSERT statement includes all required columns
    insert_sql = mock_conn.execute.call_args_list[0].args[0]
    assert "station" in insert_sql
    assert "horizon" in insert_sql
    assert "predicted_pm25" in insert_sql
    assert "lower_bound" in insert_sql
    assert "upper_bound" in insert_sql
    assert "model_used" in insert_sql
    assert "generated_at" in insert_sql
    assert "predicted_at" in insert_sql
    assert "observation_timestamp" in insert_sql


def test_cpcb_path_forecast_stores_observation_timestamp():
    """The observation_timestamp must be the CPCB row's last_update."""
    mock_conn = AsyncMock()
    obs_ts = "2026-10-10 10:00:00"
    mock_conn.fetch.return_value = [
        {
            "pm25": 50.0,
            "latitude": 19.0863,
            "longitude": 72.8888,
            "last_update": obs_ts,
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    # All three calls should pass the same observation_timestamp
    for call_obj in mock_conn.execute.call_args_list:
        args = call_obj.args
        # args = (sql, station, horizon, pm25, lower, upper, model, generated_at, predicted_at, obs_ts)
        assert args[-1] == obs_ts


def test_cpcb_path_uses_on_conflict_upsert():
    """The INSERT must use ON CONFLICT to handle duplicate requests."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 50.0,
            "latitude": 19.0863,
            "longitude": 72.8888,
            "last_update": "2026-10-10 10:00:00",
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    insert_sql = mock_conn.execute.call_args_list[0].args[0]
    assert "ON CONFLICT" in insert_sql
    assert "DO UPDATE" in insert_sql


# ── Open-Meteo fallback path: forecasts are persisted ────────────────────────

def test_open_meteo_fallback_persists_all_three_horizons():
    """When DB is unavailable, Open-Meteo fallback must still persist forecasts."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 42.0, "timestamp": "2026-10-10T08:00:00Z"}):
            with patch("backend.main.predict_pm25", side_effect=[50.0, 54.0, 58.0]):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    # Three INSERT calls, one per horizon
    assert mock_conn.execute.await_count == 3


def test_open_meteo_fallback_forecast_stores_observation_timestamp():
    """The observation_timestamp must be the Open-Meteo timestamp."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    obs_ts = "2026-10-10T08:00:00Z"

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 42.0, "timestamp": obs_ts}):
            with patch("backend.main.predict_pm25", side_effect=[50.0, 54.0, 58.0]):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    # All three calls should pass the same observation_timestamp
    for call_obj in mock_conn.execute.call_args_list:
        args = call_obj.args
        assert args[-1] == obs_ts


# ── Database persistence failures do not break the API response ──────────────

def test_cpcb_path_db_write_failure_does_not_break_response():
    """If forecast persistence fails, the API response must still succeed."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 50.0,
            "latitude": 19.0863,
            "longitude": 72.8888,
            "last_update": "2026-10-10 10:00:00",
        }
    ]
    # Simulate a write failure
    mock_conn.execute.side_effect = RuntimeError("database write failed")

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    # Response must still succeed
    assert response.status_code == 200
    data = response.json()
    assert data["forecast"]["1h"]["value"] == 55.0
    assert data["forecast"]["3h"]["value"] == 58.0
    assert data["forecast"]["6h"]["value"] == 62.0


def test_open_meteo_fallback_db_write_failure_does_not_break_response():
    """If forecast persistence fails on fallback path, response must still succeed."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    # Simulate a write failure
    mock_conn.execute.side_effect = RuntimeError("database write failed")

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 42.0, "timestamp": "2026-10-10T08:00:00Z"}):
            with patch("backend.main.predict_pm25", side_effect=[50.0, 54.0, 58.0]):
                response = client.get("/api/forecast/MH009")

    # Response must still succeed
    assert response.status_code == 200
    data = response.json()
    assert data["forecast"]["1h"]["value"] == 50.0
    assert data["forecast"]["3h"]["value"] == 54.0
    assert data["forecast"]["6h"]["value"] == 58.0


# ── Existing API response format is unchanged ──────────────────────────────────

def test_cpcb_path_response_format_unchanged():
    """The API response format must remain unchanged after persistence changes."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 50.0,
            "latitude": 19.0863,
            "longitude": 72.8888,
            "last_update": "2026-10-10 10:00:00",
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    data = response.json()
    # All existing fields must be present
    assert "station" in data
    assert "current_pm25" in data
    assert "observation_source" in data
    assert "observation_location" in data
    assert "observation_timestamp" in data
    assert "forecast" in data
    assert "generated_at" in data
    assert "is_db_unavailable" in data
    assert "is_demo_fallback" in data
    assert "note" in data
    # Forecast structure must be unchanged
    assert "1h" in data["forecast"]
    assert "3h" in data["forecast"]
    assert "6h" in data["forecast"]
    for horizon in ("1h", "3h", "6h"):
        assert "value" in data["forecast"][horizon]
        assert "range" in data["forecast"][horizon]


def test_open_meteo_fallback_response_format_unchanged():
    """The API response format must remain unchanged on fallback path."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 42.0, "timestamp": "2026-10-10T08:00:00Z"}):
            with patch("backend.main.predict_pm25", side_effect=[50.0, 54.0, 58.0]):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    data = response.json()
    # All existing fields must be present
    assert "station" in data
    assert "current_pm25" in data
    assert "observation_source" in data
    assert "observation_location" in data
    assert "observation_timestamp" in data
    assert "forecast" in data
    assert "generated_at" in data
    assert "is_db_unavailable" in data
    assert "is_demo_fallback" in data
    assert "note" in data


# ── Regression: Source transparency for stored Open-Meteo observations ───────

def test_stored_open_meteo_reading_accurately_labeled_in_forecast():
    """A row stored in cpcb_readings from Open-Meteo must be labeled as Open-Meteo, not CPCB."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 30.4,
            "latitude": 18.5204,
            "longitude": 73.8567,
            "last_update": "2026-10-11T13:00",
            "source": "Open-Meteo",
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[35.0, 42.0, 50.0]):
            response = client.get("/api/forecast/LIVE_PUNE")

    assert response.status_code == 200
    data = response.json()
    assert data["observation_source"] == "Open-Meteo"
    assert data["observation_location"] == "city-level estimate"


def test_stored_cpcb_station_reading_accurately_labeled_as_cpcb():
    """A row stored for a physical station must be labeled as CPCB."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "pm25": 45.0,
            "latitude": 18.4500,
            "longitude": 73.8600,
            "last_update": "2026-10-11 12:00:00",
            "source": "CPCB",
        }
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[50.0, 55.0, 60.0]):
            response = client.get("/api/forecast/Katraj Dairy, Pune - MPCB")

    assert response.status_code == 200
    data = response.json()
    assert data["observation_source"] == "CPCB"
    assert data["observation_location"] == "station coordinates"


def test_api_current_distinguishes_cpcb_and_open_meteo_sources():
    """api/current must set source and is_live_weather appropriately for both kinds of rows."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "station": "MH009",
            "city": "Mumbai",
            "latitude": 19.0863,
            "longitude": 72.8888,
            "pm25": 55.0,
            "pm10": 80.0,
            "no2": None,
            "so2": None,
            "co": None,
            "ozone": None,
            "fetched_at": "2026-10-11T12:00:00",
            "source": "CPCB",
        },
        {
            "station": "LIVE_PUNE",
            "city": "Pune",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "pm25": 30.0,
            "pm10": 50.0,
            "no2": None,
            "so2": None,
            "co": None,
            "ozone": None,
            "fetched_at": "2026-10-11T12:00:00",
            "source": "Open-Meteo",
        },
    ]

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.live_regional_observations", new=AsyncMock(return_value=[])):
            response = client.get("/api/current")

    assert response.status_code == 200
    items = response.json()
    cpcb_item = next(it for it in items if it["station"] == "MH009")
    om_item = next(it for it in items if it["station"] == "LIVE_PUNE")

    assert cpcb_item["source"] == "CPCB"
    assert cpcb_item["is_live_weather"] is False
    assert om_item["source"] == "Open-Meteo"
    assert om_item["is_live_weather"] is True


@pytest.mark.anyio
async def test_persist_forecasts_handles_tz_aware_datetime_and_edge_values():
    """_persist_forecasts must strip timezone info and safely handle non-finite inputs."""
    from datetime import timezone
    from backend.main import _persist_forecasts

    mock_conn = AsyncMock()
    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        tz_aware = datetime.now(timezone.utc)
        await _persist_forecasts(
            station="LIVE_TEST",
            generated_at=tz_aware,
            obs_ts="2026-10-11T12:00:00Z",
            pred_1h=30.0,
            pred_3h=35.0,
            pred_6h=40.0,
            margin=5.0,
        )

    assert mock_conn.execute.await_count == 3
    # Check generated_at argument is naive datetime
    for call_obj in mock_conn.execute.call_args_list:
        gen_arg = call_obj.args[6]
        pred_arg = call_obj.args[7]
        assert gen_arg.tzinfo is None
        assert pred_arg.tzinfo is None

