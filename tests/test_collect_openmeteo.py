"""Tests for scripts/collect_openmeteo.py.

All external API calls and database connections are mocked.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest
import requests

from scripts.collect_openmeteo import (
    fetch_observation,
    collect_and_store,
    _to_float_or_none,
)


# ── fetch_observation unit tests ─────────────────────────────────────────────

def _mock_response(json_data=None, status_code=200, raise_for=None):
    resp = MagicMock()
    resp.status_code = status_code
    if raise_for:
        resp.raise_for_status.side_effect = raise_for
    else:
        resp.raise_for_status.return_value = None
    resp.json.return_value = json_data or {}
    return resp


def test_fetch_observation_returns_all_pollutants():
    payload = {
        "current": {
            "time": "2026-10-10T12:00",
            "pm2_5": 42.5,
            "pm10": 61.0,
            "nitrogen_dioxide": 18.3,
            "sulphur_dioxide": 5.1,
            "carbon_monoxide": 220.0,
            "ozone": 55.0,
        }
    }
    with patch("scripts.collect_openmeteo.requests.get", return_value=_mock_response(payload)):
        result = fetch_observation("Mumbai", 19.076, 72.877)

    assert result["timestamp"] == "2026-10-10T12:00"
    assert result["pm25"] == 42.5
    assert result["pm10"] == 61.0
    assert result["no2"] == 18.3
    assert result["so2"] == 5.1
    assert result["co"] == 220.0
    assert result["ozone"] == 55.0


def test_fetch_observation_missing_pollutants_are_none():
    """Open-Meteo may omit some pollutant fields; they must come back as None."""
    payload = {
        "current": {
            "time": "2026-10-10T12:00",
            "pm2_5": 30.0,
            # pm10, no2, so2, co, ozone absent
        }
    }
    with patch("scripts.collect_openmeteo.requests.get", return_value=_mock_response(payload)):
        result = fetch_observation("Pune", 18.52, 73.85)

    assert result["pm25"] == 30.0
    assert result["pm10"] is None
    assert result["no2"] is None
    assert result["so2"] is None
    assert result["co"] is None
    assert result["ozone"] is None


def test_fetch_observation_api_network_failure_returns_none():
    with patch(
        "scripts.collect_openmeteo.requests.get",
        side_effect=requests.ConnectionError("network down"),
    ):
        result = fetch_observation("Nagpur", 21.14, 79.08)

    assert result is None


def test_fetch_observation_http_error_returns_none():
    resp = _mock_response(
        status_code=500,
        raise_for=requests.HTTPError("500 Server Error"),
    )
    with patch("scripts.collect_openmeteo.requests.get", return_value=resp):
        result = fetch_observation("Surat", 21.17, 72.83)

    assert result is None


def test_fetch_observation_missing_current_block_returns_none():
    with patch(
        "scripts.collect_openmeteo.requests.get",
        return_value=_mock_response({"hourly": {}}),
    ):
        result = fetch_observation("Ahmedabad", 23.02, 72.57)

    assert result is None


def test_fetch_observation_missing_timestamp_returns_none():
    payload = {"current": {"pm2_5": 20.0}}  # no "time" key
    with patch("scripts.collect_openmeteo.requests.get", return_value=_mock_response(payload)):
        result = fetch_observation("Vadodara", 22.30, 73.18)

    assert result is None


# ── _to_float_or_none ────────────────────────────────────────────────────────

def test_to_float_or_none_converts_numeric():
    assert _to_float_or_none(42) == 42.0
    assert _to_float_or_none("3.14") == pytest.approx(3.14)


def test_to_float_or_none_returns_none_for_none():
    assert _to_float_or_none(None) is None


def test_to_float_or_none_returns_none_for_non_numeric():
    assert _to_float_or_none("NA") is None
    assert _to_float_or_none("") is None


# ── collect_and_store integration tests (DB mocked) ──────────────────────────

def _make_conn_mock(execute_result="INSERT 0 1"):
    conn = AsyncMock()
    conn.execute.return_value = execute_result
    return conn


@pytest.fixture
def good_observation():
    return {
        "timestamp": "2026-10-10T12:00",
        "pm25": 42.5,
        "pm10": 61.0,
        "no2": 18.3,
        "so2": 5.1,
        "co": 220.0,
        "ozone": 55.0,
    }


def test_collect_and_store_inserts_for_each_city(good_observation):
    """A successful fetch for every city should produce one DB execute per city."""
    from src.forecasting.live_forecast_gm import CITY_COORDS

    conn = _make_conn_mock("INSERT 0 1")

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=good_observation):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        result = asyncio.run(collect_and_store())

    assert result == len(CITY_COORDS)
    assert conn.execute.await_count == len(CITY_COORDS)
    conn.close.assert_awaited_once()


def test_collect_and_store_stores_open_meteo_source(good_observation):
    """The source column must be set to 'Open-Meteo', not 'CPCB'."""
    conn = _make_conn_mock("INSERT 0 1")

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=good_observation):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        asyncio.run(collect_and_store())

    # Every call must pass "Open-Meteo" as the last positional arg
    for c in conn.execute.call_args_list:
        args = c.args  # (sql, *params)
        assert args[-1] == "Open-Meteo", f"Expected source='Open-Meteo', got {args[-1]!r}"


def test_collect_and_store_uses_live_station_id(good_observation):
    """Station IDs stored must use the LIVE_ prefix, not raw city names."""
    conn = _make_conn_mock("INSERT 0 1")

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=good_observation):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        asyncio.run(collect_and_store())

    for c in conn.execute.call_args_list:
        station_arg = c.args[1]  # second positional arg after SQL
        assert station_arg.startswith("LIVE_"), (
            f"Expected LIVE_ prefix, got {station_arg!r}"
        )


def test_collect_and_store_missing_pollutants_stored_as_null():
    """When a pollutant is absent from the API response it must be stored as NULL."""
    obs_partial = {
        "timestamp": "2026-10-10T12:00",
        "pm25": 30.0,
        "pm10": None,
        "no2": None,
        "so2": None,
        "co": None,
        "ozone": None,
    }
    conn = _make_conn_mock("INSERT 0 1")

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=obs_partial):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        asyncio.run(collect_and_store())

    # For every city call, pm10..ozone args must be None
    for c in conn.execute.call_args_list:
        args = c.args  # (sql, station, city, lat, lon, pm25, pm10, no2, so2, co, ozone, ts, source)
        _sql, _station, _city, _lat, _lon, pm25, pm10, no2, so2, co, ozone, _ts, _src = args
        assert pm25 == 30.0
        assert pm10 is None
        assert no2 is None
        assert so2 is None
        assert co is None
        assert ozone is None


def test_collect_and_store_skips_city_on_api_failure():
    """Cities where fetch_observation returns None must be skipped (not inserted)."""
    from src.forecasting.live_forecast_gm import CITY_COORDS

    conn = _make_conn_mock("INSERT 0 1")

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=None):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        result = asyncio.run(collect_and_store())

    assert result == 0
    conn.execute.assert_not_awaited()


def test_collect_and_store_duplicate_observation_does_not_raise():
    """ON CONFLICT upsert: a duplicate (station, last_update) must not raise."""
    obs = {
        "timestamp": "2026-10-10T12:00",
        "pm25": 42.5, "pm10": 61.0,
        "no2": None, "so2": None, "co": None, "ozone": None,
    }
    conn = _make_conn_mock("UPDATE 1")  # simulate conflict → update path

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=obs):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        result = asyncio.run(collect_and_store())

    from src.forecasting.live_forecast_gm import CITY_COORDS
    assert result == len(CITY_COORDS)  # all cities counted even on UPDATE path


def test_collect_and_store_db_connection_failure_raises():
    """A database connection failure must raise, not silently return 0."""
    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"):
        mock_asyncpg.connect = AsyncMock(side_effect=OSError("connection refused"))
        with pytest.raises(OSError, match="connection refused"):
            asyncio.run(collect_and_store())


def test_collect_and_store_db_insert_failure_skips_city():
    """A DB execute failure for one city must be logged and skipped, not crash."""
    from src.forecasting.live_forecast_gm import CITY_COORDS

    obs = {
        "timestamp": "2026-10-10T12:00",
        "pm25": 42.5, "pm10": 61.0,
        "no2": None, "so2": None, "co": None, "ozone": None,
    }
    conn = AsyncMock()
    conn.execute.side_effect = RuntimeError("constraint violation")

    with patch("scripts.collect_openmeteo.asyncpg") as mock_asyncpg, \
         patch("scripts.collect_openmeteo.DB_URL", "postgresql://test"), \
         patch("scripts.collect_openmeteo.fetch_observation", return_value=obs):
        mock_asyncpg.connect = AsyncMock(return_value=conn)
        result = asyncio.run(collect_and_store())

    assert result == 0  # all skipped due to DB error
    conn.close.assert_awaited_once()  # connection still closed cleanly


def test_collect_and_store_no_db_url_raises():
    """Missing DATABASE_URL must raise RuntimeError before touching the network."""
    with patch("scripts.collect_openmeteo.DB_URL", None), \
         patch("scripts.collect_openmeteo.asyncpg"):
        with pytest.raises(RuntimeError, match="DATABASE_URL is not set"):
            asyncio.run(collect_and_store())
