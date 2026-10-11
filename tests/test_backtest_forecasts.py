"""Tests for forecast backtesting script (scripts/backtest_forecasts.py)."""

import os
from datetime import datetime, timedelta, timezone

import pytest

from scripts.backtest_forecasts import (
    DEFAULT_HORIZONS,
    MatchedPair,
    MetricsResult,
    _compute_metrics,
    _match_forecasts_to_observations,
    resolve_observation_source,
)


# ── 1. Exact target-time match ────────────────────────────────────────────────

def test_exact_target_time_match():
    """Forecast with predicted_at matching observation fetched_at exactly."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "id": 1,
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        }
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time,
            "source": "CPCB",
            "last_update": "2026-10-10 12:00:00",
        }
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 1
    assert pairs[0].station == "MH009"
    assert pairs[0].forecast_value == 55.0
    assert pairs[0].observation_value == 54.5
    assert pairs[0].source == "CPCB"
    assert pairs[0].predicted_at == target_time


# ── 2. Match within tolerance ─────────────────────────────────────────────────

def test_match_within_tolerance():
    """Observation within ±30 minutes of predicted_at is valid."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "id": 1,
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        }
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time + timedelta(minutes=15),
            "source": "CPCB",
            "last_update": "2026-10-10 12:15:00",
        }
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 1
    assert pairs[0].observation_value == 54.5


# ── 3. No observation within tolerance ────────────────────────────────────────

def test_no_observation_within_tolerance():
    """Observation outside tolerance window (e.g. 45 min away) is not matched."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "id": 1,
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        }
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time + timedelta(minutes=45),
            "source": "CPCB",
            "last_update": "2026-10-10 12:45:00",
        }
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 0


# ── 4. Exclusion of observations before forecast generation ───────────────────

def test_exclude_observation_before_forecast_generation():
    """Observation before generated_at is excluded to prevent data leakage."""
    generated_at = datetime(2026, 10, 10, 11, 0, 0)
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "id": 1,
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": generated_at,
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 10:30:00",
        }
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": generated_at - timedelta(minutes=15),
            "source": "CPCB",
            "last_update": "2026-10-10 10:45:00",
        }
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 0


# ── 5. Exclusion of the seed observation ──────────────────────────────────────

def test_exclude_seed_observation():
    """Observation matching observation_timestamp is never used as outcome."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    seed_obs_ts = "2026-10-10 11:00:00"
    forecasts = [
        {
            "id": 1,
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": seed_obs_ts,
        }
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time,
            "source": "CPCB",
            "last_update": seed_obs_ts,
        }
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 0


# ── 6. Multiple candidate observations: choose the closest valid one ─────────

def test_choose_closest_valid_observation():
    """When multiple observations qualify, choose the closest to predicted_at."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "id": 1,
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        }
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 50.0,
            "fetched_at": target_time + timedelta(minutes=20),
            "source": "CPCB",
            "last_update": "2026-10-10 12:20:00",
        },
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time + timedelta(minutes=5),
            "source": "CPCB",
            "last_update": "2026-10-10 12:05:00",
        },
        {
            "station": "MH009",
            "pm25": 60.0,
            "fetched_at": target_time - timedelta(minutes=10),
            "source": "CPCB",
            "last_update": "2026-10-10 11:50:00",
        },
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 1
    assert pairs[0].observation_value == 54.5
    assert pairs[0].observation_fetched_at == target_time + timedelta(minutes=5)


# ── 7. Separate source-specific metrics ───────────────────────────────────────

def test_separate_source_specific_metrics():
    """Metrics are computed separately for CPCB and Open-Meteo, never combined."""
    pairs = [
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=55.0,
            observation_value=50.0,
            predicted_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 12, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        ),
        MatchedPair(
            station="LIVE_MUMBAI",
            horizon="1h",
            source="Open-Meteo",
            forecast_value=40.0,
            observation_value=30.0,
            predicted_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 12, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp=None,
        ),
    ]

    metrics = _compute_metrics(pairs)

    cpcb_m = next(m for m in metrics if m.source == "CPCB" and m.horizon == "1h")
    om_m = next(m for m in metrics if m.source == "Open-Meteo" and m.horizon == "1h")

    assert cpcb_m.count == 1
    assert cpcb_m.mae == 5.0
    assert om_m.count == 1
    assert om_m.mae == 10.0


# ── 8. Separate results for all three horizons ────────────────────────────────

def test_separate_results_for_all_horizons():
    """Metrics are computed and tracked separately for 1h, 3h, 6h."""
    pairs = [
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=55.0,
            observation_value=54.0,
            predicted_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 12, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        ),
        MatchedPair(
            station="MH009",
            horizon="3h",
            source="CPCB",
            forecast_value=58.0,
            observation_value=55.0,
            predicted_at=datetime(2026, 10, 10, 14, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 14, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        ),
        MatchedPair(
            station="MH009",
            horizon="6h",
            source="CPCB",
            forecast_value=62.0,
            observation_value=60.0,
            predicted_at=datetime(2026, 10, 10, 17, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 17, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        ),
    ]

    metrics = _compute_metrics(pairs)

    m_1h = next(m for m in metrics if m.horizon == "1h")
    m_3h = next(m for m in metrics if m.horizon == "3h")
    m_6h = next(m for m in metrics if m.horizon == "6h")

    assert m_1h.mae == 1.0
    assert m_3h.mae == 3.0
    assert m_6h.mae == 2.0


# ── 9. Empty database / zero matched pairs ────────────────────────────────────

def test_empty_database_zero_matched_pairs():
    """When no pairs match, matching returns empty list and metrics handle it safely."""
    forecasts = []
    observations = []

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 0
    metrics = _compute_metrics(pairs)
    assert len(metrics) == 0


# ── 10. Missing or NULL source handling ───────────────────────────────────────

def test_null_source_on_physical_station_treated_as_cpcb():
    """Physical CPCB station with source=NULL is identified as CPCB."""
    obs = {"station": "MH009", "source": None}
    assert resolve_observation_source(obs) == "CPCB"

    obs_mpcb = {"station": "Katraj Dairy, Pune - MPCB", "source": None}
    assert resolve_observation_source(obs_mpcb) == "CPCB"


def test_null_source_on_live_station_treated_as_openmeteo():
    """Synthetic station with LIVE_ prefix and source=NULL is identified as Open-Meteo, NOT CPCB."""
    obs = {"station": "LIVE_PUNE", "source": None}
    assert resolve_observation_source(obs) == "Open-Meteo"

    obs_mumbai = {"station": "LIVE_MUMBAI", "source": None}
    assert resolve_observation_source(obs_mumbai) == "Open-Meteo"


def test_missing_or_empty_station_source():
    """Observations with missing station and null source resolve to 'Unknown' rather than CPCB."""
    obs_empty = {"station": "", "source": None}
    assert resolve_observation_source(obs_empty) == "Unknown"

    obs_none = {"station": None, "source": None}
    assert resolve_observation_source(obs_none) == "Unknown"


def test_null_source_matching_flow():
    """Full matching flow correctly identifies CPCB and Open-Meteo even when source is NULL."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 50.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        },
        {
            "station": "LIVE_PUNE",
            "horizon": "1h",
            "predicted_pm25": 40.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        },
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 52.0,
            "fetched_at": target_time,
            "source": None,  # Legacy CPCB row
            "last_update": "2026-10-10 12:00:00",
        },
        {
            "station": "LIVE_PUNE",
            "pm25": 42.0,
            "fetched_at": target_time,
            "source": None,  # Synthetic LIVE row without explicit source
            "last_update": "2026-10-10 12:00:00",
        },
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 2
    cpcb_pair = next(p for p in pairs if p.station == "MH009")
    om_pair = next(p for p in pairs if p.station == "LIVE_PUNE")

    assert cpcb_pair.source == "CPCB"
    assert om_pair.source == "Open-Meteo"


# ── 11. Insufficient data result ──────────────────────────────────────────────

def test_insufficient_data_result():
    """When no pairs exist for a horizon, metrics report count=0 and mae/rmse=None."""
    pairs = [
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=55.0,
            observation_value=54.0,
            predicted_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 12, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        )
    ]
    # Evaluate across all standard horizons
    metrics = _compute_metrics(pairs, horizons=DEFAULT_HORIZONS)

    m_1h = next(m for m in metrics if m.horizon == "1h")
    m_3h = next(m for m in metrics if m.horizon == "3h")
    m_6h = next(m for m in metrics if m.horizon == "6h")

    assert m_1h.count == 1
    assert m_1h.mae == 1.0
    assert m_1h.has_sufficient_data is True

    # 3h and 6h must report insufficient data, NOT 0.0 error
    assert m_3h.count == 0
    assert m_3h.mae is None
    assert m_3h.rmse is None
    assert m_3h.has_sufficient_data is False

    assert m_6h.count == 0
    assert m_6h.mae is None
    assert m_6h.rmse is None
    assert m_6h.has_sufficient_data is False


# ── 12. Configurable source filtering ─────────────────────────────────────────

def test_source_filter_open_meteo_only():
    """--source Open-Meteo excludes CPCB observations."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": None,
        },
        {
            "station": "LIVE_PUNE",
            "horizon": "1h",
            "predicted_pm25": 40.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": None,
        },
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time,
            "source": "CPCB",
            "last_update": "2026-10-10 12:00:00",
        },
        {
            "station": "LIVE_PUNE",
            "pm25": 42.0,
            "fetched_at": target_time,
            "source": "Open-Meteo",
            "last_update": "2026-10-10 12:00:00",
        },
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "Open-Meteo")

    assert len(pairs) == 1
    assert pairs[0].source == "Open-Meteo"
    assert pairs[0].station == "LIVE_PUNE"


def test_source_filter_cpcb_only():
    """--source CPCB excludes Open-Meteo observations."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": None,
        },
        {
            "station": "LIVE_PUNE",
            "horizon": "1h",
            "predicted_pm25": 40.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": None,
        },
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 54.5,
            "fetched_at": target_time,
            "source": "CPCB",
            "last_update": "2026-10-10 12:00:00",
        },
        {
            "station": "LIVE_PUNE",
            "pm25": 42.0,
            "fetched_at": target_time,
            "source": "Open-Meteo",
            "last_update": "2026-10-10 12:00:00",
        },
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "CPCB")

    assert len(pairs) == 1
    assert pairs[0].source == "CPCB"
    assert pairs[0].station == "MH009"


def test_source_filter_all_keeps_sources_separate():
    """--source all matches both sources but metrics keep them strictly separate."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": None,
        },
        {
            "station": "LIVE_PUNE",
            "horizon": "1h",
            "predicted_pm25": 40.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": None,
        },
    ]
    observations = [
        {
            "station": "MH009",
            "pm25": 50.0,
            "fetched_at": target_time,
            "source": "CPCB",
            "last_update": "2026-10-10 12:00:00",
        },
        {
            "station": "LIVE_PUNE",
            "pm25": 30.0,
            "fetched_at": target_time,
            "source": "Open-Meteo",
            "last_update": "2026-10-10 12:00:00",
        },
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")
    assert len(pairs) == 2

    metrics = _compute_metrics(pairs)
    # CPCB error = 5, Open-Meteo error = 10; they must NEVER be averaged to 7.5
    cpcb_1h = next(m for m in metrics if m.source == "CPCB" and m.horizon == "1h")
    om_1h = next(m for m in metrics if m.source == "Open-Meteo" and m.horizon == "1h")

    assert cpcb_1h.mae == 5.0
    assert om_1h.mae == 10.0


# ── 13. Avoid counting same prediction more than once ─────────────────────────

def test_avoid_counting_same_prediction_more_than_once():
    """Even if multiple candidate observations qualify within tolerance, the prediction is matched at most once."""
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    forecasts = [
        {
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": datetime(2026, 10, 10, 11, 0, 0),
            "predicted_at": target_time,
            "observation_timestamp": "2026-10-10 11:00:00",
        }
    ]
    # 3 valid observations within tolerance
    observations = [
        {"station": "MH009", "pm25": 53.0, "fetched_at": target_time - timedelta(minutes=5), "source": "CPCB", "last_update": "2026-10-10 11:55:00"},
        {"station": "MH009", "pm25": 54.0, "fetched_at": target_time, "source": "CPCB", "last_update": "2026-10-10 12:00:00"},
        {"station": "MH009", "pm25": 55.0, "fetched_at": target_time + timedelta(minutes=10), "source": "CPCB", "last_update": "2026-10-10 12:10:00"},
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 1
    # Exactly at target_time is the closest (distance 0)
    assert pairs[0].observation_value == 54.0


# ── 14. Target time must use predicted_at, NOT observation_timestamp ──────────

def test_matching_uses_predicted_at_not_observation_timestamp():
    """Matching uses predicted_at to locate future outcome, not seed observation_timestamp."""
    gen_time = datetime(2026, 10, 10, 11, 0, 0)
    target_time = datetime(2026, 10, 10, 12, 0, 0)
    seed_ts = "2026-10-10 10:45:00"

    forecasts = [
        {
            "station": "MH009",
            "horizon": "1h",
            "predicted_pm25": 55.0,
            "generated_at": gen_time,
            "predicted_at": target_time,
            "observation_timestamp": seed_ts,
        }
    ]
    # An observation near seed_ts (10:45) is not the target; an observation near predicted_at (12:00) is.
    observations = [
        {
            "station": "MH009",
            "pm25": 40.0,
            "fetched_at": datetime(2026, 10, 10, 10, 46, 0),
            "source": "CPCB",
            "last_update": "2026-10-10 10:46:00",
        },
        {
            "station": "MH009",
            "pm25": 58.0,
            "fetched_at": target_time,
            "source": "CPCB",
            "last_update": "2026-10-10 12:00:00",
        },
    ]

    pairs = _match_forecasts_to_observations(forecasts, observations, 30, "all")

    assert len(pairs) == 1
    assert pairs[0].observation_value == 58.0


# ── 15. MAE and RMSE mathematical correctness ─────────────────────────────────

def test_mae_computation():
    """MAE is the mean absolute error: (1/n) * sum(|pred - obs|)."""
    pairs = [
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=55.0,
            observation_value=50.0,  # error = 5
            predicted_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 12, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        ),
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=60.0,
            observation_value=58.0,  # error = 2
            predicted_at=datetime(2026, 10, 10, 13, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 13, 0, 0),
            generated_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_timestamp="2026-10-10 12:00:00",
        ),
    ]

    metrics = _compute_metrics(pairs)

    m = next(res for res in metrics if res.horizon == "1h")
    # |55-50|=5, |60-58|=2 -> MAE = (5 + 2)/2 = 3.5
    assert m.mae == 3.5


def test_rmse_computation():
    """RMSE is the square root of mean squared error: sqrt((1/n) * sum((pred - obs)^2))."""
    pairs = [
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=55.0,
            observation_value=50.0,  # sq_err = 25
            predicted_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 12, 0, 0),
            generated_at=datetime(2026, 10, 10, 11, 0, 0),
            observation_timestamp="2026-10-10 11:00:00",
        ),
        MatchedPair(
            station="MH009",
            horizon="1h",
            source="CPCB",
            forecast_value=60.0,
            observation_value=58.0,  # sq_err = 4
            predicted_at=datetime(2026, 10, 10, 13, 0, 0),
            observation_fetched_at=datetime(2026, 10, 10, 13, 0, 0),
            generated_at=datetime(2026, 10, 10, 12, 0, 0),
            observation_timestamp="2026-10-10 12:00:00",
        ),
    ]

    metrics = _compute_metrics(pairs)

    m = next(res for res in metrics if res.horizon == "1h")
    # (25 + 4)/2 = 14.5; sqrt(14.5) ≈ 3.8078865
    assert pytest.approx(m.rmse, 0.001) == (14.5 ** 0.5)


# ── 16. End-to-end flow with mocked database (isolated, zero contamination) ──

@pytest.mark.anyio
async def test_backtest_forecasts_end_to_end_insufficient_data():
    """Verify backtest_forecasts() end-to-end returns insufficient data when no pairs match."""
    from unittest.mock import AsyncMock, patch
    from scripts.backtest_forecasts import backtest_forecasts

    mock_conn = AsyncMock()
    # Forecasts exist, but observations are before generated_at (no valid matches)
    mock_conn.fetch.side_effect = [
        # forecasts query
        [
            {
                "id": 1,
                "station": "MH009",
                "horizon": "1h",
                "predicted_pm25": 55.0,
                "generated_at": datetime(2026, 10, 10, 11, 0, 0),
                "predicted_at": datetime(2026, 10, 10, 12, 0, 0),
                "observation_timestamp": "2026-10-10 10:00:00",
            }
        ],
        # observations query: observation is before generated_at
        [
            {
                "station": "MH009",
                "pm25": 50.0,
                "fetched_at": datetime(2026, 10, 10, 9, 0, 0),
                "source": "CPCB",
                "last_update": "2026-10-10 09:00:00",
            }
        ],
    ]

    with patch("scripts.backtest_forecasts.asyncpg.connect", new=AsyncMock(return_value=mock_conn)):
        metrics = await backtest_forecasts(tolerance_minutes=30, source_filter="all")

    assert len(metrics) > 0
    # All metrics should report insufficient data
    for m in metrics:
        assert m.count == 0
        assert m.mae is None
        assert m.rmse is None
        assert m.has_sufficient_data is False


@pytest.mark.anyio
async def test_backtest_forecasts_end_to_end_with_valid_pairs_and_csv(tmp_path):
    """Verify backtest_forecasts() end-to-end computes metrics and writes CSV correctly."""
    from unittest.mock import AsyncMock, patch
    from scripts.backtest_forecasts import backtest_forecasts

    mock_conn = AsyncMock()
    gen_time = datetime(2026, 10, 10, 11, 0, 0)
    target_time = datetime(2026, 10, 10, 12, 0, 0)

    mock_conn.fetch.side_effect = [
        # forecasts query
        [
            {
                "id": 1,
                "station": "MH009",
                "horizon": "1h",
                "predicted_pm25": 55.0,
                "generated_at": gen_time,
                "predicted_at": target_time,
                "observation_timestamp": "2026-10-10 10:30:00",
            },
            {
                "id": 2,
                "station": "LIVE_PUNE",
                "horizon": "1h",
                "predicted_pm25": 30.0,
                "generated_at": gen_time,
                "predicted_at": target_time,
                "observation_timestamp": "2026-10-10 10:30:00",
            },
        ],
        # observations query
        [
            {
                "station": "MH009",
                "pm25": 52.0,
                "fetched_at": target_time,
                "source": "CPCB",
                "last_update": "2026-10-10 12:00:00",
            },
            {
                "station": "LIVE_PUNE",
                "pm25": 28.0,
                "fetched_at": target_time,
                "source": "Open-Meteo",
                "last_update": "2026-10-10 12:00:00",
            },
        ],
    ]

    csv_path = str(tmp_path / "backtest_test_output.csv")
    with patch("scripts.backtest_forecasts.asyncpg.connect", new=AsyncMock(return_value=mock_conn)):
        metrics = await backtest_forecasts(tolerance_minutes=30, source_filter="all", output_csv=csv_path)

    # Check metrics
    cpcb_1h = next(m for m in metrics if m.source == "CPCB" and m.horizon == "1h")
    om_1h = next(m for m in metrics if m.source == "Open-Meteo" and m.horizon == "1h")

    assert cpcb_1h.count == 1
    assert cpcb_1h.mae == 3.0  # |55 - 52| = 3.0
    assert om_1h.count == 1
    assert om_1h.mae == 2.0   # |30 - 28| = 2.0

    # Check CSV was written
    assert os.path.exists(csv_path)
    with open(csv_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "MH009" in content
    assert "LIVE_PUNE" in content

