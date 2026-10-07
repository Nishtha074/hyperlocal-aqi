"""Forecast uncertainty utilities for pollution-risk alerts.

The project does not yet have a trained uncertainty model, so this module uses
an explicit deterministic estimate derived from the forecast spread. The result
is transparent and explainable in the UI without making medical claims.
"""

from __future__ import annotations

from typing import Any, Dict, Optional


def estimate_uncertainty(
    forecast_aqi: Any,
    current_aqi: Any = None,
    spread_factor: float = 0.35,
) -> Dict[str, Any]:
    """Estimate the forecast spread and confidence level.

    The range is anchored to the forecast value and widened based on the current
    AQI and the expected variability in the forecast window. This keeps the
    uncertainty output explainable and avoids fabricated model-specific metrics.
    """
    forecast_value = float(forecast_aqi) if forecast_aqi is not None else None
    current_value = float(current_aqi) if current_aqi is not None else None
    if forecast_value is None:
        return {"confidence": "unknown", "low": None, "high": None, "spread": None}

    baseline_spread = max(10.0, abs(forecast_value * spread_factor))
    if current_value is not None:
        baseline_spread = max(baseline_spread, abs(forecast_value - current_value) * 0.5)

    low_value = max(0.0, forecast_value - baseline_spread)
    high_value = forecast_value + baseline_spread

    if baseline_spread >= 40.0 or forecast_value >= 150:
        confidence = "low"
    elif baseline_spread >= 20.0:
        confidence = "moderate"
    else:
        confidence = "high"

    return {
        "confidence": confidence,
        "low": round(low_value, 1),
        "high": round(high_value, 1),
        "spread": round(baseline_spread, 1),
    }


def get_uncertainty_snapshot(
    forecast_aqi: Any,
    current_aqi: Any = None,
) -> Optional[Dict[str, Any]]:
    if forecast_aqi is None:
        return None
    return estimate_uncertainty(forecast_aqi=forecast_aqi, current_aqi=current_aqi)


def build_uncertainty_alert(
    uncertainty: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not uncertainty:
        return None

    confidence = str(uncertainty.get("confidence", "")).lower()
    low_value = uncertainty.get("low")
    high_value = uncertainty.get("high")

    if confidence == "low" and low_value is not None and high_value is not None:
        return {
            "type": "uncertainty",
            "text": f"⚠️ Prediction confidence is low; expected range {float(low_value):.0f}–{float(high_value):.0f}.",
        }
    return None
