import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

@pytest.fixture
def unavailable_alert_database(monkeypatch):
    async def fail_connection(*args, **kwargs):
        raise OSError("simulated database outage")

    monkeypatch.setattr("backend.routes_alerts.asyncpg.connect", fail_connection)


def test_create_alert_database_unavailable(unavailable_alert_database):
    payload = {
        "user_id": "test_user",
        "station": "Pune",
        "pollutant": "pm25",
        "operator": ">",
        "threshold": 100.0,
        "is_enabled": True
    }
    response = client.post("/api/alerts", json=payload)
    assert response.status_code == 503
    assert response.json()["detail"] == "Database unavailable; alert was not created."
    assert "password" not in response.text.lower()

def test_list_alerts_database_unavailable(unavailable_alert_database):
    response = client.get("/api/alerts?user_id=test_user")
    assert response.status_code == 503

def test_update_alert_database_unavailable(unavailable_alert_database):
    response = client.put("/api/alerts/1", json={"is_enabled": False})
    assert response.status_code == 503

def test_delete_alert_database_unavailable(unavailable_alert_database):
    response = client.delete("/api/alerts/1")
    assert response.status_code == 503

def test_get_events_database_unavailable(unavailable_alert_database):
    response = client.get("/api/alerts/1/events")
    assert response.status_code == 503


def test_invalid_alert_values_are_rejected_before_database_access():
    invalid_payloads = [
        {"station": "Pune", "pollutant": "pm25", "operator": "!=", "threshold": 50},
        {"station": "Pune", "pollutant": "pm2.5", "operator": ">", "threshold": 50},
        {"station": "Pune", "pollutant": "pm25", "operator": ">", "threshold": -1},
    ]
    for payload in invalid_payloads:
        assert client.post("/api/alerts", json=payload).status_code == 422


def test_api_lifespan_starts_alert_evaluation():
    with patch("backend.main.evaluate_alerts", new_callable=AsyncMock) as evaluate:
        with TestClient(app):
            pass
    evaluate.assert_awaited_once()


def test_alert_crud_and_event_history_with_mock_database():
    mock_conn = AsyncMock()
    alert_row = {
        "id": 41,
        "user_id": "demo_user",
        "station": "Pune",
        "pollutant": "pm25",
        "operator": ">=",
        "threshold": 50.0,
        "is_enabled": True,
        "created_at": datetime.now(timezone.utc),
    }
    event_row = {
        "id": 90,
        "alert_id": 41,
        "pollutant": "pm25",
        "observed_value": 62.0,
        "threshold_crossed": 50.0,
        "observation_timestamp": datetime.now(timezone.utc),
        "notification_status": "unconfigured",
    }
    mock_conn.fetchrow.side_effect = [alert_row, {**alert_row, "is_enabled": False}]
    mock_conn.fetch.return_value = [alert_row]
    mock_conn.execute.return_value = "DELETE 1"

    with patch("backend.routes_alerts.get_conn", new=AsyncMock(return_value=mock_conn)):
        created = client.post(
            "/api/alerts",
            json={"station": "Pune", "pollutant": "pm25", "operator": ">=", "threshold": 50},
        )
        listed = client.get("/api/alerts?user_id=demo_user")
        updated = client.put("/api/alerts/41", json={"is_enabled": False})
        deleted = client.delete("/api/alerts/41")
        mock_conn.fetch.return_value = [event_row]
        history = client.get("/api/alerts/41/events")

    assert created.status_code == 201
    assert created.json()["id"] == 41
    assert listed.status_code == 200 and listed.json()[0]["station"] == "Pune"
    assert updated.status_code == 200 and updated.json()["is_enabled"] is False
    assert "is_enabled = $1" in mock_conn.fetchrow.call_args_list[1].args[0]
    assert deleted.status_code == 200
    assert history.status_code == 200
    assert history.json()[0]["observed_value"] == 62.0

# Mock DB interaction logic is not needed for unit tests of endpoints because 
# the focus is verifying DB failures when no DB is available.

