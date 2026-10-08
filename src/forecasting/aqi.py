import math

PM25_BREAKS = [
    (0, 30, 0, 50),
    (30, 60, 51, 100),
    (60, 90, 101, 200),
    (90, 120, 201, 300),
    (120, 250, 301, 400),
    (250, 500, 401, 500),
]


def pm25_to_aqi(pm25):
    if pm25 is None:
        return None

    try:
        pm25 = float(pm25)
    except (TypeError, ValueError):
        return None

    if math.isnan(pm25):
        return None

    pm25 = max(0.0, pm25)

    for lo, hi, aqi_lo, aqi_hi in PM25_BREAKS:
        if pm25 <= hi:
            return round(
                (aqi_hi - aqi_lo) / (hi - lo)
                * (pm25 - lo)
                + aqi_lo
            )

    return 500


def aqi_category(aqi):
    if aqi is None:
        return "Unknown"

    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"

    return "Severe"