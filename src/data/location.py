import requests


def get_current_location():
    data = requests.get(
        "https://ipinfo.io/json",
        timeout=10
    ).json()

    lat, lon = map(float, data["loc"].split(","))

    return {
        "city": data.get("city", "Unknown"),
        "lat": lat,
        "lon": lon,
    }