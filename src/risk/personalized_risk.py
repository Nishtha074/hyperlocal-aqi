"""Transparent personalized AQI risk engine for the dashboard.

This implementation intentionally follows a simple, explainable rule-based
approach rather than making medical claims. The engine adjusts a base AQI
threshold by age group, activity level, and sensitivity category so the user
profile changes the risk outcome for the same AQI conditions.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

AGE_GROUP_FACTORS = {
    "Child": 0.92,
    "Adult": 1.0,
    "Older adult": 0.88,
}

ACTIVITY_FACTORS = {
    "Low": 1.0,
    "Moderate": 0.9,
    "High": 0.8,
}

SENSITIVITY_FACTORS = {
    "General": 1.0,
    "Sensitive": 0.85,
    "Highly sensitive": 0.7,
}


def normalize_profile(profile: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Normalize the profile dictionary to expected labels."""
    if not profile:
        return {
            "age_group": "Adult",
            "activity_level": "Moderate",
            "sensitivity_category": "General",
        }

    normalized = {
        "age_group": str(profile.get("age_group", "Adult")).strip() or "Adult",
        "activity_level": str(profile.get("activity_level", "Moderate")).strip() or "Moderate",
        "sensitivity_category": str(profile.get("sensitivity_category", "General")).strip() or "General",
    }

    if normalized["age_group"] not in AGE_GROUP_FACTORS:
        normalized["age_group"] = "Adult"
    if normalized["activity_level"] not in ACTIVITY_FACTORS:
        normalized["activity_level"] = "Moderate"
    if normalized["sensitivity_category"] not in SENSITIVITY_FACTORS:
        normalized["sensitivity_category"] = "General"

    return normalized


def calculate_personalized_threshold(
    age_group: str = "Adult",
    activity_level: str = "Moderate",
    sensitivity_category: str = "General",
    base_aqi_threshold: float = 100.0,
) -> float:
    """Return a traceable threshold adjusted by the active profile.

    The base threshold is intentionally set around 100 AQI because this is the
    point at which air quality starts to be consistently less favorable for
    sensitive groups. The profile then makes the threshold more or less
    conservative for the same air conditions.
    """
    profile = normalize_profile(
        {
            "age_group": age_group,
            "activity_level": activity_level,
            "sensitivity_category": sensitivity_category,
        }
    )

    multiplier = (
        AGE_GROUP_FACTORS[profile["age_group"]]
        * ACTIVITY_FACTORS[profile["activity_level"]]
        * SENSITIVITY_FACTORS[profile["sensitivity_category"]]
    )
    threshold = base_aqi_threshold * multiplier
    return round(float(max(40.0, min(180.0, threshold))), 1)


def _as_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return default
        try:
            return float(stripped)
        except ValueError:
            return default
    return default


def _parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _risk_level_from_peak(peak_aqi: Optional[float], threshold: float) -> str:
    if peak_aqi is None:
        return "Low"
    ratio = peak_aqi / max(threshold, 1.0)
    if ratio < 0.8:
        return "Low"
    if ratio < 1.1:
        return "Moderate"
    if ratio < 1.5:
        return "High"
    return "Very High"


def calculate_personalized_risk(
    current_aqi: Any,
    forecast_aqi: Any,
    forecast_time: Any,
    profile: Optional[Dict[str, Any]] = None,
    base_aqi_threshold: float = 100.0,
    uncertainty: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Calculate a transparent risk level for the provided AQI and profile."""
    normalized_profile = normalize_profile(profile)
    threshold = calculate_personalized_threshold(
        age_group=normalized_profile["age_group"],
        activity_level=normalized_profile["activity_level"],
        sensitivity_category=normalized_profile["sensitivity_category"],
        base_aqi_threshold=base_aqi_threshold,
    )

    current_aqi_value = _as_float(current_aqi)
    forecast_aqi_value = _as_float(forecast_aqi)
    values = [value for value in (current_aqi_value, forecast_aqi_value) if value is not None]
    peak_value = max(values) if values else None
    risk_level = _risk_level_from_peak(peak_value, threshold)

    forecast_dt = _parse_datetime(forecast_time)
    if current_aqi_value is not None and forecast_aqi_value is not None and forecast_dt is not None:
        time_until_forecast = (forecast_dt - datetime.now()).total_seconds() / 3600.0
    else:
        time_until_forecast = None

    if current_aqi_value is not None and forecast_aqi_value is not None:
        if current_aqi_value <= threshold and forecast_aqi_value <= threshold:
            explanation = (
                "Pollution exposure risk is low for this profile because both the current AQI and the near-term forecast remain below the personalized threshold."
            )
        elif current_aqi_value > threshold and forecast_aqi_value > threshold:
            explanation = (
                "Air quality conditions are unfavorable for this profile, with both the current AQI and the near-term forecast elevated above the personalized threshold."
            )
        else:
            explanation = (
                "Air quality conditions are less favorable for this profile, and the near-term forecast may increase exposure risk."
            )
    elif current_aqi_value is not None:
        explanation = (
            "Pollution exposure risk is based on the current AQI and the user profile. A forecast snapshot is unavailable at the moment."
        )
    elif forecast_aqi_value is not None:
        explanation = (
            "The near-term forecast suggests elevated exposure risk for this profile, while a current AQI reading is unavailable."
        )
    else:
        explanation = (
            "Personalized pollution-risk information is currently unavailable because AQI readings are missing."
        )

    return {
        "profile": normalized_profile,
        "personalized_threshold": threshold,
        "risk_level": risk_level,
        "explanation": explanation,
        "current_aqi": current_aqi_value,
        "forecast_aqi": forecast_aqi_value,
        "forecast_time": forecast_dt,
        "time_until_forecast_hours": time_until_forecast,
        "uncertainty": uncertainty,
    }


def build_alerts(
    profile: Optional[Dict[str, Any]],
    current_aqi: Any = None,
    forecast_aqi: Any = None,
    forecast_time: Any = None,
    uncertainty: Optional[Dict[str, Any]] = None,
) -> list[Dict[str, Any]]:
    """Return a list of user-visible alert objects.

    Each alert contains a short text string and a stable type so the dashboard can
    render them without creating duplicate notifications on refresh.
    """
    if not profile:
        return [{"type": "profile", "text": "Please complete the profile before personalized alerts are calculated."}]

    normalized_profile = normalize_profile(profile)
    threshold = calculate_personalized_threshold(
        age_group=normalized_profile["age_group"],
        activity_level=normalized_profile["activity_level"],
        sensitivity_category=normalized_profile["sensitivity_category"],
    )

    alerts: list[Dict[str, Any]] = []
    current_value = _as_float(current_aqi)
    forecast_value = _as_float(forecast_aqi)
    forecast_dt = _parse_datetime(forecast_time)

    if current_value is None:
        alerts.append(
            {
                "type": "info",
                "text": "Current AQI is unavailable. Personalized current-air alerts will appear when a fresh reading is available.",
            }
        )
    elif current_value > threshold:
        alerts.append(
            {
                "type": "current_aqi",
                "text": f"⚠️ AQI is currently high — {current_value:.0f}. Personalized threshold: {threshold:.0f}.",
            }
        )

    if forecast_value is not None and forecast_dt is not None:
        delta_hours = (forecast_dt - datetime.now()).total_seconds() / 3600.0
        if 0 <= delta_hours <= 2 and forecast_value > threshold:
            hours_remaining = max(delta_hours, 0.0)
            alerts.append(
                {
                    "type": "forecast",
                    "text": (
                        "⚠️ AQI expected to cross your threshold within 2 hours. "
                        f"Forecast AQI: {forecast_value:.0f}. Threshold: {threshold:.0f}. "
                        f"Forecast time: {forecast_dt.strftime('%Y-%m-%d %H:%M')}. "
                        f"Approximate time until threshold crossing: {hours_remaining:.1f} hours."
                    ),
                }
            )

    if uncertainty:
        confidence = str(uncertainty.get("confidence", "")).lower()
        low_value = _as_float(uncertainty.get("low"))
        high_value = _as_float(uncertainty.get("high"))
        if confidence == "low" and low_value is not None and high_value is not None:
            alerts.append(
                {
                    "type": "uncertainty",
                    "text": (
                        f"⚠️ Prediction confidence is low; expected range {low_value:.0f}–{high_value:.0f}."
                    ),
                }
            )

    if not alerts:
        alerts.append({"type": "info", "text": "✓ No significant pollution alerts at this time."})

    # Ensure duplicate alert types are not rendered repeatedly in a single refresh.
    deduped: list[Dict[str, Any]] = []
    seen_types = set()
    for alert in alerts:
        alert_type = alert.get("type")
        if alert_type in seen_types:
            continue
        deduped.append(alert)
        seen_types.add(alert_type)
    return deduped
