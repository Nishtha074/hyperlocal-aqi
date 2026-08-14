import requests, csv, os
from datetime import datetime

LAT, LON = 18.5204, 73.8567  # Pune coordinates
OUT_FILE = "data/raw/weather/pune_weather_history.csv"

url = "https://api.open-meteo.com/v1/forecast"
params = {
    "latitude": LAT,
    "longitude": LON,
    "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover"
}

resp = requests.get(url, params=params)
resp.raise_for_status()
data = resp.json()["current"]
data["fetched_at"] = datetime.now().isoformat(timespec="seconds")

os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
file_exists = os.path.exists(OUT_FILE)

with open(OUT_FILE, "a", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(data.keys()))
    if not file_exists:
        writer.writeheader()
    writer.writerow(data)

print("Saved weather snapshot:", data)