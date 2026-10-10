import requests, os
import asyncpg
import asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

URL = f"https://api.data.gov.in/resource/{os.getenv('DATA_GOV_RESOURCE_ID')}"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
PARAMS = {
    "api-key": os.getenv("DATA_GOV_API_KEY"),
    "format": "json",
    "filters[state]": os.getenv("CPCB_STATE", "Maharashtra"),
    "filters[city]": os.getenv("CPCB_CITY", "Pune"),
    "limit": 200
}
DB_URL = os.getenv("DATABASE_URL")

def fetch():
    try:
        resp = requests.get(URL, params=PARAMS, headers=HEADERS, timeout=30)
    except requests.RequestException as exc:
        raise RuntimeError(f"CPCB request failed ({type(exc).__name__})") from None
    if not resp.ok:
        raise RuntimeError(f"CPCB request failed with HTTP {resp.status_code}")
    try:
        return resp.json().get("records", [])
    except ValueError:
        raise RuntimeError("CPCB response was not valid JSON") from None

def reshape(records):
    stations = {}
    for r in records:
        key = r["station"]
        if key not in stations:
            stations[key] = {
                "station": r["station"], "city": r["city"], "state": r["state"],
                "latitude": float(r["latitude"]) if r.get("latitude") else None,
                "longitude": float(r["longitude"]) if r.get("longitude") else None,
                "last_update": r["last_update"]
            }
        val = r["avg_value"]
        pollutant_key = r["pollutant_id"].lower().replace(".", "")
        stations[key][pollutant_key] = None if val == "NA" else float(val)
    return list(stations.values())

async def save_to_db(rows):
    if not DB_URL:
        print("DATABASE_URL not set!")
        return
    conn = await asyncpg.connect(DB_URL)
    for row in rows:
        try:
            await conn.execute("""
                INSERT INTO cpcb_readings (station, city, state, latitude, longitude,
                    pm25, pm10, no2, so2, co, ozone, nh3, last_update)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            """, row["station"], row["city"], row["state"], row["latitude"], row["longitude"],
                 row.get("pm25"), row.get("pm10"), row.get("no2"), row.get("so2"),
                 row.get("co"), row.get("ozone"), row.get("nh3"), row["last_update"])
        except Exception as e:
            print(f"Error inserting row for {row['station']}: {e}")
    await conn.close()
    print(f"Saved {len(rows)} rows to Postgres")

if __name__ == "__main__":
    records = fetch()
    rows = reshape(records)
    asyncio.run(save_to_db(rows))