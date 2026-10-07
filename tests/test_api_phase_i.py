from unittest.mock import patch

import pandas as pd

from src.dashboard_helpers import get_latest_air_quality_snapshot


@patch("src.dashboard_helpers.pd.read_csv")
def test_api_unavailable_returns_friendly_snapshot(mock_read_csv):
    mock_read_csv.side_effect = Exception("API timeout")
    snapshot = get_latest_air_quality_snapshot()
    assert isinstance(snapshot, dict)
    assert "current_aqi" in snapshot
    assert "forecast_map" in snapshot


@patch("src.dashboard_helpers.pd.read_csv")
def test_invalid_api_response_is_handled(mock_read_csv):
    mock_read_csv.return_value = pd.DataFrame({"Datetime": [], "AQI": []})
    snapshot = get_latest_air_quality_snapshot()
    assert snapshot["current_aqi"] is None
