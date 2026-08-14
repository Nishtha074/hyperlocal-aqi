import requests, os, csv
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

URL = f"https://api.data.gov.in/resource/{os.getenv('DATA_GOV_RESOURCE_ID')}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}
PARAMS = {
    "api-key": os.getenv("DATA_GOV_API_KEY"),
    "format": "json",
    "filters[state]": os.getenv("CPCB_STATE"),
    "filters[city]": os.getenv("CPCB_CITY"),
    "limit": 200
}

OUT_FILE = "data/raw/cpcb/pune_cpcb_history.csv"

def fetch():
    resp = requests.get(URL, params=PARAMS, headers=HEADERS)
    resp.raise_for_status()
    return resp.json().get("records", [])

def reshape(records):
    """Group rows by station into one row per station with pollutants as columns."""
    stations = {}
    for r in records:
        key = r["station"]
        if key not in stations:
            stations[key] = {
                "fetched_at": datetime.now().isoformat(timespec="seconds"),
                "last_update": r["last_update"],
                "station": r["station"],
                "city": r["city"],
                "state": r["state"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
            }
        pollutant = r["pollutant_id"]
        stations[key][pollutant] = r["avg_value"]
    return list(stations.values())

def save(rows):
    if not rows:
        print("No rows to save.")
        return

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

    all_keys = set()
    for row in rows:
        all_keys.update(row.keys())
    fixed_cols = ["fetched_at", "last_update", "station", "city", "state", "latitude", "longitude"]
    pollutant_cols = sorted(all_keys - set(fixed_cols))
    fieldnames = fixed_cols + pollutant_cols

    file_exists = os.path.exists(OUT_FILE)
    with open(OUT_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for row in rows:
            writer.writerow(row)

    print(f"Saved {len(rows)} station rows to {OUT_FILE}")

if __name__ == "__main__":
    records = fetch()
    rows = reshape(records)
    save(rows)
    for row in rows:
        print(row.get("station"), "| PM2.5:", row.get("PM2.5"), "| PM10:", row.get("PM10"))