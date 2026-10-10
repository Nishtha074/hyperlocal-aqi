"""
Seed realistic Pune AQI station data directly into Supabase.
Run once to populate cpcb_readings so the frontend shows live cards.
"""
import asyncpg
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

PUNE_STATIONS = [
    {"station": "Katraj Dairy, Pune - MPCB", "latitude": 18.4529, "longitude": 73.8561, "pm25": 42.3, "pm10": 78.5, "no2": 32.1, "so2": 8.4, "co": 0.9, "ozone": 41.2},
    {"station": "Alandi, Pune - MPCB",       "latitude": 18.6749, "longitude": 73.9005, "pm25": 38.7, "pm10": 65.3, "no2": 28.6, "so2": 6.1, "co": 0.7, "ozone": 38.4},
    {"station": "Pashan, Pune - MPCB",        "latitude": 18.5362, "longitude": 73.8068, "pm25": 55.1, "pm10": 92.4, "no2": 41.3, "so2": 11.2, "co": 1.1, "ozone": 47.9},
    {"station": "Hadapsar, Pune - MPCB",      "latitude": 18.5023, "longitude": 73.9311, "pm25": 67.8, "pm10": 110.2, "no2": 51.7, "so2": 14.6, "co": 1.4, "ozone": 52.3},
    {"station": "Lohegaon, Pune - MPCB",      "latitude": 18.5818, "longitude": 73.9116, "pm25": 48.5, "pm10": 85.1, "no2": 36.4, "so2": 9.8, "co": 0.9, "ozone": 44.1},
    {"station": "Shivajinagar, Pune - MPCB",  "latitude": 18.5308, "longitude": 73.8475, "pm25": 61.4, "pm10": 104.7, "no2": 47.2, "so2": 13.0, "co": 1.3, "ozone": 49.6},
    {"station": "Pimpri, Pune - MPCB",        "latitude": 18.6298, "longitude": 73.7997, "pm25": 75.2, "pm10": 128.3, "no2": 58.9, "so2": 18.1, "co": 1.7, "ozone": 55.8},
    {"station": "Bhosari, Pune - MPCB",       "latitude": 18.6428, "longitude": 73.8523, "pm25": 82.6, "pm10": 143.1, "no2": 63.4, "so2": 21.3, "co": 1.9, "ozone": 58.2},
]

async def seed():
    conn = await asyncpg.connect(DB_URL)
    count = 0
    for s in PUNE_STATIONS:
        await conn.execute("""
            INSERT INTO cpcb_readings
                (station, city, state, latitude, longitude, pm25, pm10, no2, so2, co, ozone, nh3, last_update)
            VALUES ($1,'Pune','Maharashtra',$2,$3,$4,$5,$6,$7,$8,$9,NULL,'2026-10-07T15:30:00')
        """,
            s["station"], s["latitude"], s["longitude"],
            s["pm25"], s["pm10"], s["no2"], s["so2"], s["co"], s["ozone"]
        )
        count += 1
    await conn.close()
    print(f"✅ Seeded {count} stations into Supabase cpcb_readings")

asyncio.run(seed())
