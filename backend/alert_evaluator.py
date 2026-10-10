import asyncio
import logging
import math
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import asyncpg
from dotenv import load_dotenv

from src.data.live_aqi import get_live_aqi
from src.forecasting.aqi import pm25_to_aqi
from src.forecasting.live_forecast_gm import CITY_COORDS, station_city_map

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
logger = logging.getLogger(__name__)
_evaluation_lock = asyncio.Lock()


def _parse_observation_timestamp(value, naive_timezone=timezone.utc):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=naive_timezone)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _is_fresh_observation(timestamp, now=None):
    timestamp = _parse_observation_timestamp(timestamp)
    if timestamp is None:
        return False
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        max_age_minutes = float(os.getenv("ALERT_MAX_OBSERVATION_AGE_MINUTES", "180"))
        if not math.isfinite(max_age_minutes) or max_age_minutes <= 0:
            raise ValueError
    except ValueError:
        logger.error("Invalid ALERT_MAX_OBSERVATION_AGE_MINUTES; using 180 minutes")
        max_age_minutes = 180
    age = now - timestamp
    return timedelta(minutes=-5) <= age <= timedelta(minutes=max_age_minutes)


def _threshold_crossed(value, operator, threshold):
    return (
        (operator == ">" and value > threshold)
        or (operator == ">=" and value >= threshold)
        or (operator == "<" and value < threshold)
        or (operator == "<=" and value <= threshold)
    )


async def evaluate_alerts():
    if not DB_URL:
        logger.warning("Database not configured. Skipping alert evaluation.")
        return

    async with _evaluation_lock:
        conn = None
        try:
            conn = await asyncpg.connect(DB_URL)
            alerts = await conn.fetch("SELECT * FROM alerts WHERE is_enabled = TRUE")
            if not alerts:
                return

            logger.info("Evaluating %s enabled alerts", len(alerts))
            stations = {alert["station"] for alert in alerts}
            observations = {}

            for station in stations:
                row = await conn.fetchrow("""
                    SELECT pm25, pm10, last_update FROM cpcb_readings
                    WHERE station = $1 ORDER BY fetched_at DESC LIMIT 1
                """, station)

                if row and (row["pm25"] is not None or row["pm10"] is not None):
                    observations[station] = {
                        "pm25": row["pm25"],
                        "pm10": row["pm10"],
                        "aqi": pm25_to_aqi(row["pm25"]),
                        "timestamp": _parse_observation_timestamp(
                            row["last_update"], ZoneInfo("Asia/Kolkata")
                        ),
                    }
                    continue

                city = station_city_map.get(station, station)
                coordinates = CITY_COORDS.get(city)
                if coordinates is None:
                    logger.warning("No observation coordinates configured for station %s", station)
                    continue

                try:
                    live_aqi = get_live_aqi(*coordinates)
                    observations[station] = {
                        "pm25": live_aqi.get("pm25"),
                        "pm10": live_aqi.get("pm10"),
                        "aqi": pm25_to_aqi(live_aqi.get("pm25")),
                        "timestamp": _parse_observation_timestamp(live_aqi.get("timestamp")),
                    }
                except Exception as exc:
                    logger.warning("Live observation fetch failed for station %s (%s)", station, type(exc).__name__)

            for alert in alerts:
                observation = observations.get(alert["station"])
                if observation is None:
                    continue
                if not _is_fresh_observation(observation.get("timestamp")):
                    logger.warning("Skipping stale or timestamp-free observation for station %s", alert["station"])
                    continue

                value = observation.get(alert["pollutant"].lower())
                if value is None or not _threshold_crossed(value, alert["operator"], alert["threshold"]):
                    continue

                event_id = await conn.fetchval("""
                    INSERT INTO alert_events
                        (alert_id, pollutant, observed_value, threshold_crossed, observation_timestamp, notification_status)
                    VALUES ($1, $2, $3, $4, $5, 'pending')
                    ON CONFLICT (alert_id, observation_timestamp) DO NOTHING
                    RETURNING id
                """, alert["id"], alert["pollutant"], value, alert["threshold"], observation["timestamp"])
                if event_id is not None:
                    logger.info("Alert %s triggered for %s", alert["id"], alert["pollutant"])
                    await deliver_notification(conn, event_id, alert, observation, value)
        except Exception as exc:
            logger.error(
                "Alert evaluation failed (%s; SQLSTATE %s)",
                type(exc).__name__,
                getattr(exc, "sqlstate", None) or "unavailable",
            )
        finally:
            if conn is not None:
                await conn.close()


async def deliver_notification(conn, event_id, alert, obs, value):
    provider = os.getenv("NOTIFICATION_PROVIDER")
    if not provider:
        logger.info("Alert event %s persisted; notification provider is not configured", event_id)
        await conn.execute(
            "UPDATE alert_events SET notification_status = 'unconfigured' WHERE id = $1",
            event_id,
        )
        return

    logger.error("Notification provider %s has no delivery adapter configured", provider)
    await conn.execute(
        "UPDATE alert_events SET notification_status = 'failed' WHERE id = $1",
        event_id,
    )


if __name__ == "__main__":
    asyncio.run(evaluate_alerts())
