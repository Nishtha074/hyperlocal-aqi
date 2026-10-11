"""Tests for station identity, coordinates, and forecast generation correctness."""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from src.forecasting.live_forecast_gm import (
    CITY_COORDS,
    STATION_COORDS,
    station_city_map,
    find_nearest_station,
    predict_pm25,
)
from backend.main import app, _station_for_city, _city_for_station

client = TestClient(app)


# ── Station mapping correctness ───────────────────────────────────────────────

def test_mh_stations_all_map_to_mumbai():
    """MH005-MH014 must all resolve to Mumbai, not Pune/Nagpur/Aurangabad."""
    for station_id in ("MH005", "MH006", "MH007", "MH008", "MH009",
                       "MH010", "MH011", "MH012", "MH013", "MH014"):
        assert station_city_map[station_id] == "Mumbai", (
            f"{station_id} should map to Mumbai, got {station_city_map[station_id]}"
        )


def test_gj001_maps_to_ahmedabad():
    assert station_city_map["GJ001"] == "Ahmedabad"


def test_station_coords_are_within_mumbai_bounding_box():
    """Per-station coordinates must be within the greater Mumbai area."""
    # Mumbai bounding box: lat 18.85–19.30, lon 72.75–73.00
    for station_id, (lat, lon) in STATION_COORDS.items():
        assert 18.85 <= lat <= 19.30, f"{station_id} lat {lat} outside Mumbai range"
        assert 72.75 <= lon <= 73.00, f"{station_id} lon {lon} outside Mumbai range"


def test_station_coords_match_known_values():
    """Spot-check specific station coordinates against spatial_station_features.csv."""
    assert STATION_COORDS["MH009"] == pytest.approx((19.0863, 72.8888), abs=1e-4)  # Kurla
    assert STATION_COORDS["MH014"] == pytest.approx((18.9936, 72.8128), abs=1e-4)  # Worli
    assert STATION_COORDS["MH007"] == pytest.approx((19.1008, 72.8746), abs=1e-4)  # Airport T2


def test_find_nearest_station_uses_per_station_coords():
    """find_nearest_station should return the geographically closest station."""
    # Kurla coords → should return MH009
    nearest = find_nearest_station(19.0863, 72.8888)
    assert nearest == "MH009"

    # Worli coords → should return MH014
    nearest = find_nearest_station(18.9936, 72.8128)
    assert nearest == "MH014"


def test_find_nearest_station_ahmedabad():
    """Ahmedabad coords should resolve to GJ001."""
    lat, lon = CITY_COORDS["Ahmedabad"]
    nearest = find_nearest_station(lat, lon)
    assert nearest == "GJ001"


# ── _station_for_city always returns LIVE_ prefix ────────────────────────────

def test_station_for_city_always_returns_live_prefix():
    """Synthetic Open-Meteo entries must never use real CPCB station IDs."""
    for city in ("Mumbai", "Pune", "Nagpur", "Aurangabad", "Thane", "Anand"):
        result = _station_for_city(city)
        assert result.startswith("LIVE_"), (
            f"_station_for_city({city!r}) returned {result!r}, expected LIVE_ prefix"
        )
        assert result not in station_city_map, (
            f"_station_for_city({city!r}) returned a real CPCB station ID {result!r}"
        )


def test_city_for_station_resolves_live_prefix():
    """_city_for_station should resolve LIVE_ IDs back to a city name."""
    city = _city_for_station("LIVE_MUMBAI")
    assert city == "Mumbai"

    city = _city_for_station("LIVE_NAVI_MUMBAI")
    assert city == "Navi Mumbai"


def test_city_for_station_resolves_cpcb_ids():
    assert _city_for_station("MH009") == "Mumbai"
    assert _city_for_station("MH014") == "Mumbai"
    assert _city_for_station("MH007") == "Mumbai"
    assert _city_for_station("GJ001") == "Ahmedabad"


# ── Forecast endpoint: timestamps and source labelling ───────────────────────

def test_forecast_cpcb_row_labels_source_as_cpcb():
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {"pm25": 55.0, "latitude": 19.0863, "longitude": 72.8888,
         "last_update": "2026-10-10 10:00:00"}
    ]
    mock_conn.fetchval.return_value = None

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[60.0, 63.0, 67.0]):
            response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    data = response.json()
    assert data["observation_source"] == "CPCB"
    assert data["observation_timestamp"] == "2026-10-10 10:00:00"
    assert data["current_pm25"] == 55.0
    assert "XGBoost" in data["note"]


def test_forecast_open_meteo_fallback_labels_source_correctly():
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    mock_conn.fetchval.return_value = None

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 42.0, "timestamp": "2026-10-10T08:00:00Z"}):
            with patch("backend.main.predict_pm25", side_effect=[50.0, 54.0, 58.0]):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    data = response.json()
    assert data["observation_source"] == "Open-Meteo"
    assert data["observation_location"] == "city-level estimate"
    assert data["observation_timestamp"] == "2026-10-10T08:00:00Z"
    assert data["is_demo_fallback"] is False
    assert "XGBoost" in data["note"]


def test_forecast_persistence_fallback_does_not_claim_xgboost():
    """When the ML model fails, the note must not claim XGBoost generated the values."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    mock_conn.fetchval.return_value = None

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 42.0, "timestamp": "2026-10-10T08:00:00Z"}):
            with patch("backend.main.predict_pm25", side_effect=RuntimeError("model broken")):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    data = response.json()
    # All three horizons should equal the current observation (persistence)
    assert data["forecast"]["1h"]["value"] == 42.0
    assert data["forecast"]["3h"]["value"] == 42.0
    assert data["forecast"]["6h"]["value"] == 42.0
    # Note must not claim XGBoost produced these values
    assert "XGBoost" not in data["note"]
    assert "persistence" in data["note"].lower() or "unavailable" in data["note"].lower()


def test_forecast_three_horizons_are_distinct_when_model_works():
    """1h, 3h, 6h values must differ when the model produces different outputs."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {"pm25": 50.0, "latitude": 19.0863, "longitude": 72.8888,
         "last_update": "2026-10-10 10:00:00"}
    ]
    mock_conn.fetchval.return_value = None

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[55.0, 58.0, 62.0]):
            response = client.get("/api/forecast/MH009")

    data = response.json()
    assert data["forecast"]["1h"]["value"] == 55.0
    assert data["forecast"]["3h"]["value"] == 58.0
    assert data["forecast"]["6h"]["value"] == 62.0


def test_forecast_unknown_station_returns_404():
    with patch("backend.main.get_conn", side_effect=OSError("no db")):
        response = client.get("/api/forecast/UNKNOWN_XYZ")
    assert response.status_code == 404
    assert "No supported location mapping" in response.json()["detail"]


# ── Live regional observations use LIVE_ IDs, not CPCB IDs ──────────────────

def test_live_regional_observations_use_live_prefix():
    """Open-Meteo city entries in /api/current must carry LIVE_ station IDs."""
    with patch("backend.main.get_conn", side_effect=OSError("no db")):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 35.0, "pm10": 55.0,
                                 "timestamp": "2026-10-10T10:00:00Z"}):
            response = client.get("/api/current")

    assert response.status_code == 200
    for obs in response.json():
        assert obs["station"].startswith("LIVE_"), (
            f"Expected LIVE_ prefix, got {obs['station']!r}"
        )
        assert obs["station"] not in station_city_map, (
            f"Open-Meteo entry used real CPCB station ID {obs['station']!r}"
        )


# ── Forecast fallback: station-identity regression tests ─────────────────────

def test_fallback_mh009_uses_station_coords_for_model_not_city_centroid():
    """In the Open-Meteo fallback, predict_pm25 must receive Kurla coords
    (19.0863, 72.8888), not the Mumbai city centroid (19.0760, 72.8777).
    This ensures find_nearest_station activates StationId_MH009, not MH005."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    captured_coords = []

    def capture_predict(pm25, lat, lon):
        captured_coords.append((lat, lon))
        return pm25 * 0.95  # deterministic stand-in

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 66.1, "timestamp": "2026-10-11T11:00"}):
            with patch("backend.main.predict_pm25", side_effect=capture_predict):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    # predict_pm25 is called three times (1h, 3h, 6h)
    assert len(captured_coords) == 3
    kurla_lat, kurla_lon = 19.0863, 72.8888
    for lat, lon in captured_coords:
        assert lat == pytest.approx(kurla_lat, abs=1e-4), (
            f"predict_pm25 received lat={lat}, expected Kurla lat={kurla_lat}"
        )
        assert lon == pytest.approx(kurla_lon, abs=1e-4), (
            f"predict_pm25 received lon={lon}, expected Kurla lon={kurla_lon}"
        )


def test_fallback_mh009_open_meteo_queried_at_city_centroid():
    """The Open-Meteo observation must be fetched at the Mumbai city centroid
    (19.0760, 72.8777), not the Kurla station coordinates."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 66.1, "timestamp": "2026-10-11T11:00"}) as mock_aqi:
            with patch("backend.main.predict_pm25", side_effect=[60.0, 57.0, 55.0]):
                response = client.get("/api/forecast/MH009")

    assert response.status_code == 200
    call_lat, call_lon = mock_aqi.call_args.args
    mumbai_lat, mumbai_lon = 19.0760, 72.8777
    assert call_lat == pytest.approx(mumbai_lat, abs=1e-4), (
        f"get_live_aqi called with lat={call_lat}, expected Mumbai centroid {mumbai_lat}"
    )
    assert call_lon == pytest.approx(mumbai_lon, abs=1e-4), (
        f"get_live_aqi called with lon={call_lon}, expected Mumbai centroid {mumbai_lon}"
    )


def test_fallback_mh009_response_labels_observation_as_city_level_estimate():
    """observation_location must be 'city-level estimate' for MH009 fallback
    because Open-Meteo is queried at the Mumbai centroid, not Kurla."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 66.1, "timestamp": "2026-10-11T11:00"}):
            with patch("backend.main.predict_pm25", side_effect=[60.0, 57.0, 55.0]):
                response = client.get("/api/forecast/MH009")

    data = response.json()
    assert data["observation_source"] == "Open-Meteo"
    assert data["observation_location"] == "city-level estimate"


def test_fallback_mh009_response_station_id_is_preserved():
    """The response station field must remain MH009, not be replaced by a city name."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 66.1, "timestamp": "2026-10-11T11:00"}):
            with patch("backend.main.predict_pm25", side_effect=[60.0, 57.0, 55.0]):
                response = client.get("/api/forecast/MH009")

    assert response.json()["station"] == "MH009"


def test_fallback_live_mumbai_uses_city_centroid_for_both_obs_and_model():
    """LIVE_MUMBAI has no STATION_COORDS entry; both the Open-Meteo query and
    model inference must use the Mumbai city centroid, and observation_location
    must be 'city-level estimate'."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []

    captured_model_coords = []

    def capture_predict(pm25, lat, lon):
        captured_model_coords.append((lat, lon))
        return pm25 * 0.95

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.get_live_aqi",
                   return_value={"pm25": 55.0, "timestamp": "2026-10-11T11:00"}) as mock_aqi:
            with patch("backend.main.predict_pm25", side_effect=capture_predict):
                response = client.get("/api/forecast/LIVE_MUMBAI")

    assert response.status_code == 200
    data = response.json()
    assert data["observation_location"] == "city-level estimate"
    mumbai_lat, mumbai_lon = 19.0760, 72.8777
    # Open-Meteo queried at city centroid
    obs_lat, obs_lon = mock_aqi.call_args.args
    assert obs_lat == pytest.approx(mumbai_lat, abs=1e-4)
    assert obs_lon == pytest.approx(mumbai_lon, abs=1e-4)
    # Model also uses city centroid (no STATION_COORDS for LIVE_MUMBAI)
    for lat, lon in captured_model_coords:
        assert lat == pytest.approx(mumbai_lat, abs=1e-4)
        assert lon == pytest.approx(mumbai_lon, abs=1e-4)


def test_cpcb_path_observation_location_is_station_coordinates():
    """When a stored CPCB row is used, observation_location must be
    'station coordinates' because the row's own lat/lon are used."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {"pm25": 55.0, "latitude": 19.0863, "longitude": 72.8888,
         "last_update": "2026-10-11T10:00:00"}
    ]
    mock_conn.fetchval.return_value = None

    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        with patch("backend.main.predict_pm25", side_effect=[60.0, 57.0, 55.0]):
            response = client.get("/api/forecast/MH009")

    data = response.json()
    assert data["observation_source"] == "CPCB"
    assert data["observation_location"] == "station coordinates"

def test_history_mh009_returns_stored_rows_in_chronological_order():
    """MH009 with DB rows returns them oldest-first; no synthetic data."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {"pm25": 55.0, "pm10": 80.0, "no2": None, "fetched_at": "2026-10-10T10:00:00"},
        {"pm25": 52.0, "pm10": 77.0, "no2": None, "fetched_at": "2026-10-10T09:00:00"},
    ]
    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        response = client.get("/api/station/MH009/history?hours=24")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 2
    # DB returns DESC; endpoint reverses to chronological order
    assert rows[0]["fetched_at"] == "2026-10-10T09:00:00"
    assert rows[1]["fetched_at"] == "2026-10-10T10:00:00"
    # No synthetic source label
    for row in rows:
        assert "source" not in row or "derived" not in row.get("source", "")


def test_history_mh009_empty_db_returns_empty_list():
    """MH009 with no stored rows returns an empty list, not fabricated data."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        response = client.get("/api/station/MH009/history?hours=24")

    assert response.status_code == 200
    assert response.json() == []


def test_history_mh009_db_unavailable_returns_503():
    """MH009 when the DB is unreachable must return 503, not fabricated history."""
    with patch("backend.main.get_conn", side_effect=OSError("simulated outage")):
        response = client.get("/api/station/MH009/history?hours=24")

    assert response.status_code == 503
    assert "Database unavailable" in response.json()["detail"]


def test_history_live_mumbai_returns_404():
    """LIVE_ IDs are synthetic; they have no stored history."""
    response = client.get("/api/station/LIVE_MUMBAI/history")
    assert response.status_code == 404
    assert "No stored history" in response.json()["detail"]


def test_history_unknown_station_returns_404():
    """Unrecognised station IDs must return 404 without touching the DB."""
    with patch("backend.main.get_conn") as mock_get_conn:
        response = client.get("/api/station/UNKNOWN_XYZ/history")

    assert response.status_code == 404
    assert "No stored history" in response.json()["detail"]
    mock_get_conn.assert_not_called()


def test_history_query_uses_station_parameter_and_hours_limit():
    """The DB query must filter by station and respect the hours limit."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []
    with patch("backend.main.get_conn", new=AsyncMock(return_value=mock_conn)):
        client.get("/api/station/MH009/history?hours=12")

    query, station_arg, limit_arg = mock_conn.fetch.call_args.args
    assert "WHERE station = $1" in query
    assert station_arg == "MH009"
    assert limit_arg == 12
