import requests, os, asyncpg, asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
LAT, LON = 18.5204, 73.8567

async def save_to_db(data):
    if not DB_URL:
        print("DATABASE_URL not set!")
        return
    conn = await asyncpg.connect(DB_URL)
    await conn.execute("""
        INSERT INTO weather_readings (temperature, relative_humidity, precipitation,
            wind_speed, wind_direction, surface_pressure, cloud_cover)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
    """, data["temperature_2m"], data["relative_humidity_2m"], data["precipitation"],
         data["wind_speed_10m"], data["wind_direction_10m"], data["surface_pressure"],
         data["cloud_cover"])
    await conn.close()

if __name__ == "__main__":
    resp = requests.get("https://api.open-meteo.com/v1/forecast", params={
        "latitude": LAT, "longitude": LON,
        "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover"
    })
    data = resp.json()["current"]
    asyncio.run(save_to_db(data))
    print("Saved weather:", data)