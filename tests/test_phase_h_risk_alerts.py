from datetime import datetime, timedelta

from src.risk.personalized_risk import (
    calculate_personalized_risk,
    calculate_personalized_threshold,
    build_alerts,
)


def test_safe_aqi_and_forecast_with_good_confidence_are_low_risk():
    profile = {
        "age_group": "Adult",
        "activity_level": "Low",
        "sensitivity_category": "General",
    }
    risk = calculate_personalized_risk(
        current_aqi=35,
        forecast_aqi=42,
        forecast_time=datetime.now() + timedelta(hours=1),
        uncertainty={"confidence": "high", "low": 25, "high": 52},
        profile=profile,
    )

    assert risk["risk_level"] in {"Low", "Moderate"}
    assert risk["personalized_threshold"] > 0
    assert risk["current_aqi"] == 35


def test_current_aqi_above_threshold_triggers_current_alert():
    profile = {"age_group": "Adult", "activity_level": "Moderate", "sensitivity_category": "Sensitive"}
    threshold = calculate_personalized_threshold(**profile)
    alerts = build_alerts(
        profile=profile,
        current_aqi=threshold * 1.3,
        forecast_aqi=threshold * 0.8,
        forecast_time=datetime.now() + timedelta(hours=5),
        uncertainty={"confidence": "high", "low": 50, "high": 90},
    )

    current_alerts = [alert for alert in alerts if alert["type"] == "current_aqi"]
    assert current_alerts
    assert "currently high" in current_alerts[0]["text"].lower()


def test_forecast_crosses_threshold_within_two_hours_triggers_forecast_alert():
    profile = {"age_group": "Adult", "activity_level": "Moderate", "sensitivity_category": "General"}
    threshold = calculate_personalized_threshold(**profile)
    alerts = build_alerts(
        profile=profile,
        current_aqi=70,
        forecast_aqi=threshold * 1.15,
        forecast_time=datetime.now() + timedelta(hours=1, minutes=30),
        uncertainty={"confidence": "high", "low": 65, "high": 110},
    )

    forecast_alerts = [alert for alert in alerts if alert["type"] == "forecast"]
    assert forecast_alerts
    assert "within 2 hours" in forecast_alerts[0]["text"].lower()


def test_forecast_crossing_after_more_than_two_hours_does_not_trigger_alert():
    profile = {"age_group": "Adult", "activity_level": "Moderate", "sensitivity_category": "General"}
    alerts = build_alerts(
        profile=profile,
        current_aqi=60,
        forecast_aqi=180,
        forecast_time=datetime.now() + timedelta(hours=3),
        uncertainty={"confidence": "high", "low": 140, "high": 200},
    )

    forecast_alerts = [alert for alert in alerts if alert["type"] == "forecast"]
    assert not forecast_alerts


def test_low_prediction_confidence_triggers_uncertainty_alert_with_expected_range():
    profile = {"age_group": "Adult", "activity_level": "Low", "sensitivity_category": "Sensitive"}
    alerts = build_alerts(
        profile=profile,
        current_aqi=80,
        forecast_aqi=120,
        forecast_time=datetime.now() + timedelta(hours=1),
        uncertainty={"confidence": "low", "low": 90, "high": 170},
    )

    uncertainty_alerts = [alert for alert in alerts if alert["type"] == "uncertainty"]
    assert uncertainty_alerts
    assert "low" in uncertainty_alerts[0]["text"].lower()
    assert "90" in uncertainty_alerts[0]["text"]
    assert "170" in uncertainty_alerts[0]["text"]


def test_different_profiles_change_threshold_and_risk():
    base = {
        "age_group": "Adult",
        "activity_level": "Moderate",
        "sensitivity_category": "General",
    }
    risky = {"age_group": "Child", "activity_level": "High", "sensitivity_category": "Highly sensitive"}

    threshold_base = calculate_personalized_threshold(**base)
    threshold_risky = calculate_personalized_threshold(**risky)

    assert threshold_risky < threshold_base

    risk_base = calculate_personalized_risk(current_aqi=110, forecast_aqi=90, forecast_time=datetime.now() + timedelta(hours=1), profile=base)
    risk_risky = calculate_personalized_risk(current_aqi=110, forecast_aqi=90, forecast_time=datetime.now() + timedelta(hours=1), profile=risky)

    assert risk_risky["risk_level"] in {"High", "Very High"}
    assert risk_base["risk_level"] in {"Low", "Moderate", "High"}


def test_missing_aqi_does_not_crash_and_returns_info_message():
    alerts = build_alerts(
        profile={"age_group": "Adult", "activity_level": "Low", "sensitivity_category": "General"},
        current_aqi=None,
        forecast_aqi=70,
        forecast_time=datetime.now() + timedelta(hours=1),
        uncertainty={"confidence": "high", "low": 55, "high": 85},
    )

    assert isinstance(alerts, list)
    assert not any(alert["type"] == "current_aqi" for alert in alerts)


def test_missing_forecast_keeps_current_aqi_functionality_working():
    profile = {"age_group": "Adult", "activity_level": "Low", "sensitivity_category": "General"}
    alerts = build_alerts(
        profile=profile,
        current_aqi=120,
        forecast_aqi=None,
        forecast_time=None,
        uncertainty={"confidence": "high", "low": 95, "high": 130},
    )

    current_alerts = [alert for alert in alerts if alert["type"] == "current_aqi"]
    assert current_alerts


def test_missing_uncertainty_skips_fake_alert():
    profile = {"age_group": "Adult", "activity_level": "Low", "sensitivity_category": "General"}
    alerts = build_alerts(
        profile=profile,
        current_aqi=80,
        forecast_aqi=90,
        forecast_time=datetime.now() + timedelta(hours=1),
        uncertainty=None,
    )

    assert not any(alert["type"] == "uncertainty" for alert in alerts)


def test_updating_profile_changes_risk_and_alerts():
    baseline_profile = {"age_group": "Adult", "activity_level": "Low", "sensitivity_category": "General"}
    updated_profile = {"age_group": "Older adult", "activity_level": "High", "sensitivity_category": "Highly sensitive"}

    risk_before = calculate_personalized_risk(
        current_aqi=95,
        forecast_aqi=100,
        forecast_time=datetime.now() + timedelta(hours=1),
        profile=baseline_profile,
    )
    risk_after = calculate_personalized_risk(
        current_aqi=95,
        forecast_aqi=100,
        forecast_time=datetime.now() + timedelta(hours=1),
        profile=updated_profile,
    )

    assert risk_after["personalized_threshold"] < risk_before["personalized_threshold"]
    assert risk_after["risk_level"] in {"High", "Very High"}
