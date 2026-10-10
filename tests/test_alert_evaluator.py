import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from unittest.mock import patch, MagicMock, AsyncMock
from backend.alert_evaluator import (
    _is_fresh_observation,
    _parse_observation_timestamp,
    _threshold_crossed,
    deliver_notification,
    evaluate_alerts,
)
from src.forecasting.aqi import pm25_to_aqi

def test_evaluate_alerts_database_unconfigured():
    # evaluate_alerts should skip if DATABASE_URL is not set
    with patch("backend.alert_evaluator.DB_URL", None):
        asyncio.run(evaluate_alerts())


@patch("backend.alert_evaluator.DB_URL", "dummy_url")
@patch("backend.alert_evaluator.asyncpg.connect")
def test_disabled_alerts_are_not_evaluated(mock_connect):
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    mock_connect.return_value = mock_conn

    asyncio.run(evaluate_alerts())

    assert "WHERE is_enabled = TRUE" in mock_conn.fetch.call_args.args[0]
    mock_conn.fetchrow.assert_not_called()
    mock_conn.fetchval.assert_not_called()


@patch("backend.alert_evaluator.DB_URL", "dummy_url")
@patch("backend.alert_evaluator.asyncpg.connect")
def test_measurement_without_source_timestamp_does_not_create_event(mock_connect):
    mock_conn = AsyncMock()
    mock_connect.return_value = mock_conn
    mock_conn.fetch.return_value = [
        {"id": 1, "station": "Pune", "pollutant": "pm25", "operator": ">", "threshold": 50.0}
    ]
    mock_conn.fetchrow.return_value = {"pm25": 100.0, "pm10": None, "last_update": None}

    asyncio.run(evaluate_alerts())

    mock_conn.fetchval.assert_not_called()


@patch("backend.alert_evaluator.DB_URL", "dummy_url")
@patch("backend.alert_evaluator.asyncpg.connect")
def test_cpcb_aqi_alert_uses_project_pm25_conversion(mock_connect):
    mock_conn = AsyncMock()
    mock_connect.return_value = mock_conn
    mock_conn.fetch.return_value = [
        {"id": 1, "station": "Pune", "pollutant": "aqi", "operator": ">", "threshold": 100.0}
    ]
    mock_conn.fetchrow.return_value = {
        "pm25": 75.0,
        "pm10": None,
        "last_update": datetime.now(timezone.utc).isoformat(),
    }
    mock_conn.fetchval.return_value = 101

    with patch("backend.alert_evaluator.deliver_notification", new_callable=AsyncMock):
        asyncio.run(evaluate_alerts())

    assert mock_conn.fetchval.call_args.args[3] == pm25_to_aqi(75.0)


def test_observation_freshness_rejects_missing_stale_and_future_timestamps():
    now = datetime(2026, 10, 10, 12, 0, 0)
    assert _is_fresh_observation(now - timedelta(minutes=30), now)
    assert not _is_fresh_observation(None, now)
    assert not _is_fresh_observation(now - timedelta(minutes=181), now)
    assert not _is_fresh_observation(now + timedelta(minutes=6), now)
    assert _parse_observation_timestamp(
        "2026-10-10T12:00:00", ZoneInfo("Asia/Kolkata")
    ) == datetime(2026, 10, 10, 6, 30)


@pytest.mark.parametrize(
    ("value", "operator", "threshold", "expected"),
    [
        (51, ">", 50, True),
        (50, ">", 50, False),
        (50, ">=", 50, True),
        (49, "<", 50, True),
        (50, "<", 50, False),
        (50, "<=", 50, True),
    ],
)
def test_threshold_comparison(value, operator, threshold, expected):
    assert _threshold_crossed(value, operator, threshold) is expected

@patch("backend.alert_evaluator.DB_URL", "dummy_url")
@patch("backend.alert_evaluator.asyncpg.connect")
@patch("backend.alert_evaluator.get_live_aqi")
def test_evaluate_alerts_with_mock_db(mock_get_live_aqi, mock_connect):
    mock_conn = AsyncMock()
    mock_connect.return_value = mock_conn
    
    # Mock alerts
    mock_conn.fetch.return_value = [
        {"id": 1, "station": "Pune", "pollutant": "pm25", "operator": ">", "threshold": 50.0}
    ]
    
    # Mock cpcb observations to be None so it falls back to Open-Meteo
    mock_conn.fetchrow.return_value = None
    
    observation_timestamp = datetime.now(timezone.utc).isoformat()
    mock_get_live_aqi.return_value = {
        "pm25": 75.0,
        "timestamp": observation_timestamp
    }
    
    mock_conn.fetchrow.return_value = None
    
    mock_conn.fetchval.return_value = 100 # event_id
    
    asyncio.run(evaluate_alerts())
    
    # Verify Open-Meteo was called
    mock_get_live_aqi.assert_called_once()
    
    # Verify event was inserted
    mock_conn.fetchval.assert_called_once()
    args, _ = mock_conn.fetchval.call_args
    assert "INSERT INTO alert_events" in args[0]
    assert args[1:5] == (1, "pm25", 75.0, 50.0)
    assert args[5] == _parse_observation_timestamp(observation_timestamp)
    
    assert mock_conn.execute.call_count >= 1

@patch("backend.alert_evaluator.DB_URL", "dummy_url")
@patch("backend.alert_evaluator.asyncpg.connect")
def test_evaluate_alerts_duplicate_prevention(mock_connect):
    mock_conn = AsyncMock()
    mock_connect.return_value = mock_conn
    
    # Mock alerts
    mock_conn.fetch.return_value = [
        {"id": 1, "station": "Pune", "pollutant": "pm25", "operator": ">", "threshold": 50.0}
    ]
    
    # Mock cpcb observations
    mock_conn.fetchrow.return_value = {
        "pm25": 100.0,
        "pm10": None,
        "last_update": datetime.now(timezone.utc).isoformat(),
    }
    mock_conn.fetchval.return_value = None
    
    asyncio.run(evaluate_alerts())
    
    # The unique constraint rejects an already-recorded alert/timestamp pair.
    mock_conn.fetchval.assert_called_once()
    assert "ON CONFLICT (alert_id, observation_timestamp) DO NOTHING" in mock_conn.fetchval.call_args.args[0]
    assert mock_conn.execute.call_count == 0


def test_unconfigured_notification_is_recorded(monkeypatch):
    monkeypatch.delenv("NOTIFICATION_PROVIDER", raising=False)
    mock_conn = AsyncMock()

    asyncio.run(deliver_notification(mock_conn, 12, {"id": 1}, {}, 75.0))

    query, event_id = mock_conn.execute.call_args.args
    assert "notification_status = 'unconfigured'" in query
    assert event_id == 12


def test_unimplemented_notification_provider_is_not_marked_sent(monkeypatch):
    monkeypatch.setenv("NOTIFICATION_PROVIDER", "smtp")
    mock_conn = AsyncMock()

    asyncio.run(deliver_notification(mock_conn, 13, {"id": 1}, {}, 75.0))

    query, event_id = mock_conn.execute.call_args.args
    assert "notification_status = 'failed'" in query
    assert "notification_status = 'sent'" not in query
    assert event_id == 13
