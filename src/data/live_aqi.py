import requests


def get_live_aqi(lat, lon):
    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}"
        f"&longitude={lon}"
        "&current=pm2_5,pm10,us_aqi"
        "&timezone=UTC"
    )

    response = requests.get(url, timeout=10)
    data = response.json()

    current = data["current"]

    return {
        "aqi": current["us_aqi"],
        "pm25": current["pm2_5"],
        "pm10": current["pm10"],
        "timestamp": current["time"]
    }