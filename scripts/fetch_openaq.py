import requests, os, csv
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENAQ_API_KEY")
HEADERS = {"X-API-Key": API_KEY}

LAT, LON = 18.5204, 73.8567
RADIUS_METERS = 25000
OUT_FILE = "data/raw/openaq/pune_openaq_history.csv"

# Step 1: get locations near Pune
loc_resp = requests.get(
    "https://api.openaq.org/v3/locations",
    params={"coordinates": f"{LAT},{LON}", "radius": RADIUS_METERS, "limit": 50},
    headers=HEADERS
)
locations = loc_resp.json().get("results", [])

rows = []
fetched_at = datetime.now().isoformat(timespec="seconds")

for loc in locations:
    loc_id = loc["id"]

    # Build sensorId -> parameter name map from location's own sensor list
    sensor_map = {}
    for sensor in loc.get("sensors", []):
        param_name = sensor.get("parameter", {}).get("name")
        sensor_map[sensor["id"]] = param_name

    # Get latest readings for this location
    latest_resp = requests.get(
        f"https://api.openaq.org/v3/locations/{loc_id}/latest",
        headers=HEADERS
    )
    if latest_resp.status_code != 200:
        continue

    for r in latest_resp.json().get("results", []):
        sensor_id = r.get("sensorsId")
        rows.append({
            "fetched_at": fetched_at,
            "location_id": loc_id,
            "location_name": loc["name"],
            "latitude": r.get("coordinates", {}).get("latitude"),
            "longitude": r.get("coordinates", {}).get("longitude"),
            "parameter": sensor_map.get(sensor_id, f"unknown_sensor_{sensor_id}"),
            "value": r.get("value"),
            "datetime_utc": r.get("datetime", {}).get("utc")
        })

print(f"Collected {len(rows)} measurement rows")

if rows:
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    file_exists = os.path.exists(OUT_FILE)
    with open(OUT_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        if not file_exists:
            writer.writeheader()
        writer.writerows(rows)
    print(f"Saved to {OUT_FILE}")
    for row in rows[:12]:
        print(row["location_name"], "-", row["parameter"], "-", row["value"], "-", row["datetime_utc"])