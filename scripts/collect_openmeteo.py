"""
collect_openmeteo.py — Fetch hourly Open-Meteo air-quality observations for all
configured city locations and store them in the cpcb_readings table.

These are modelled, city-level estimates (source='Open-Meteo'), not official
CPCB sensor readings.  The collector is safe to rerun: an upsert on
(station, last_update) skips observations that are already stored.

Run one collection cycle:
    python scripts/collect_openmeteo.py

Schedule hourly on Windows Task Scheduler:
    Action:  Start a program
    Program: C:\\path\\to\\python.exe
    Arguments: scripts\\collect_openmeteo.py
    Start in: C:\\path\\to\\hyperlocal-aqi
    Trigger: Daily, repeat every 1 hour indefinitely
"""

import asyncio
import logging
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

# Allow running from the repo root without installing the package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import asyncpg
except ImportError:
    asyncpg = None  # type: ignore[assignment]

from src.forecasting.live_forecast_gm import CITY_COORDS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("collect_openmeteo")

DB_URL = os.getenv("DATABASE_URL")

# Open-Meteo air-quality variables to request.  All are optional in the
# response; missing values are stored as NULL rather than fabricated.
_AQ_VARS = "pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone"



def fetch_observation(city: str, lat: float, lon: float) -> list[dict] | None:
    """Fetch hourly Open-Meteo values for the recent past and near future."""
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": _AQ_VARS,
        "past_days": 2,
        "forecast_days": 2,
        "timezone": "UTC",
    }

    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.error("Open-Meteo request failed for %s: %s", city, exc)
        return None

    hourly = data.get("hourly")
    if not hourly or not hourly.get("time"):
        logger.warning("Open-Meteo response missing hourly data for %s", city)
        return None

    times = hourly["time"]
    variables = {
        "pm25": hourly.get("pm2_5", []),
        "pm10": hourly.get("pm10", []),
        "no2": hourly.get("nitrogen_dioxide", []),
        "so2": hourly.get("sulphur_dioxide", []),
        "co": hourly.get("carbon_monoxide", []),
        "ozone": hourly.get("ozone", []),
    }

    observations = []
    for i, timestamp in enumerate(times):
        observations.append({
            "timestamp": timestamp,
            **{
                name: values[i] if i < len(values) else None
                for name, values in variables.items()
            },
        })

    return observations



def _to_float_or_none(value) -> float | None:
    """Return float(value) or None; never fabricate a value."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def collect_and_store() -> int:
    """Fetch observations for all CITY_COORDS locations and upsert into DB.

    Returns the number of rows inserted or updated.
    """
    if asyncpg is None:
        raise RuntimeError("asyncpg is not installed; cannot store observations")
    if not DB_URL:
        raise RuntimeError("DATABASE_URL is not set; cannot store observations")

    inserted = 0
    skipped = 0

    try:
        conn = await asyncpg.connect(DB_URL)
    except Exception as exc:
        logger.error("Database connection failed (%s: %s)", type(exc).__name__, exc)
        raise

    try:
        for city, (lat, lon) in CITY_COORDS.items():
            station = f"LIVE_{city.upper().replace(' ', '_')}"
            
            observations = fetch_observation(city, lat, lon)
            if observations is None:
                skipped += 1
                continue

            station = f"LIVE_{city.upper().replace(' ', '_')}"

            for obs in observations:
                pm25 = _to_float_or_none(obs["pm25"])
                pm10 = _to_float_or_none(obs["pm10"])
                no2 = _to_float_or_none(obs["no2"])
                so2 = _to_float_or_none(obs["so2"])
                co = _to_float_or_none(obs["co"])
                ozone = _to_float_or_none(obs["ozone"])
                timestamp = obs["timestamp"]

                try:
                    await conn.execute(
                        """
                        INSERT INTO cpcb_readings
                            (station, city, latitude, longitude,
                             pm25, pm10, no2, so2, co, ozone,
                             last_update, source)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (station, last_update) DO UPDATE
                            SET pm25 = EXCLUDED.pm25,
                                pm10 = EXCLUDED.pm10,
                                no2 = EXCLUDED.no2,
                                so2 = EXCLUDED.so2,
                                co = EXCLUDED.co,
                                ozone = EXCLUDED.ozone,
                                source = EXCLUDED.source,
                                fetched_at = CURRENT_TIMESTAMP
                        """,
                        station, city, lat, lon,
                        pm25, pm10, no2, so2, co, ozone,
                        timestamp, "Open-Meteo",
                    )
                    inserted += 1
                except Exception as exc:
                    logger.error(
                        "Database insert failed for %s at %s (%s: %s)",
                        city, timestamp, type(exc).__name__, exc,
                    )
                    skipped += 1
    finally:
        await conn.close()

    logger.info(
        "Collection complete: %d stored, %d skipped (API or DB failures)",
        inserted, skipped,
    )
    return inserted


if __name__ == "__main__":
    asyncio.run(collect_and_store())
