import asyncio
import asyncpg
import os
import logging
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
logger = logging.getLogger(__name__)

async def init_db():
    if not DB_URL:
        logger.error("DATABASE_URL is not set; database initialization cannot run")
        raise RuntimeError("DATABASE_URL is not configured")

    conn = None
    try:
        conn = await asyncpg.connect(DB_URL)
        logger.info("Connected to database. Initializing schema...")

        # Create cpcb_readings table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS cpcb_readings (
                id SERIAL PRIMARY KEY,
                station VARCHAR(255) NOT NULL,
                city VARCHAR(100),
                state VARCHAR(100),
                latitude FLOAT,
                longitude FLOAT,
                pm25 FLOAT,
                pm10 FLOAT,
                no2 FLOAT,
                so2 FLOAT,
                co FLOAT,
                ozone FLOAT,
                nh3 FLOAT,
                last_update VARCHAR(255),
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source VARCHAR(50)
            );
        """)

        # Add source column to pre-existing tables that lack it
        await conn.execute("""
            ALTER TABLE cpcb_readings ADD COLUMN IF NOT EXISTS source VARCHAR(50);
        """)

        # Unique index to prevent duplicate observations per station+timestamp
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_cpcb_station_last_update
            ON cpcb_readings (station, last_update);
        """)

        # Create weather_readings table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS weather_readings (
                id SERIAL PRIMARY KEY,
                temperature FLOAT,
                relative_humidity FLOAT,
                precipitation FLOAT,
                wind_speed FLOAT,
                wind_direction FLOAT,
                surface_pressure FLOAT,
                cloud_cover FLOAT,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create forecasts table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS forecasts (
                id SERIAL PRIMARY KEY,
                station VARCHAR(255) NOT NULL,
                horizon VARCHAR(50),
                predicted_pm25 FLOAT,
                lower_bound FLOAT,
                upper_bound FLOAT,
                model_used VARCHAR(100),
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                predicted_at TIMESTAMP,
                observation_timestamp VARCHAR(255)
            );
        """)

        # Add new columns to pre-existing forecasts rows that lack them
        await conn.execute("""
            ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS predicted_at TIMESTAMP;
        """)
        await conn.execute("""
            ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS observation_timestamp VARCHAR(255);
        """)

        # Backfill predicted_at for existing rows that have a parseable horizon
        # and a non-null generated_at.  Rows with unrecognised horizons are left NULL.
        await conn.execute("""
            UPDATE forecasts
            SET predicted_at = CASE horizon
                WHEN '1h' THEN generated_at + INTERVAL '1 hour'
                WHEN '3h' THEN generated_at + INTERVAL '3 hours'
                WHEN '6h' THEN generated_at + INTERVAL '6 hours'
            END
            WHERE predicted_at IS NULL
              AND generated_at IS NOT NULL
              AND horizon IN ('1h', '3h', '6h');
        """)

        # Unique index: one forecast row per (station, horizon, predicted_at).
        # This allows the same station+horizon to be stored for different target
        # times (e.g. hourly runs) while preventing duplicate rows from repeated
        # requests within the same minute.  predicted_at may be NULL for legacy
        # rows; NULL values are not considered equal by unique indexes in
        # PostgreSQL, so those rows are never blocked by this constraint.
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_forecasts_station_horizon_predicted_at
            ON forecasts (station, horizon, predicted_at);
        """)

        # Create model_metrics table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS model_metrics (
                id SERIAL PRIMARY KEY,
                model_name VARCHAR(100),
                mae FLOAT,
                rmse FLOAT,
                r2 FLOAT,
                evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create alerts table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255),
                station VARCHAR(255),
                pollutant VARCHAR(50),
                operator VARCHAR(10),
                threshold FLOAT,
                is_enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create alert_events table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS alert_events (
                id SERIAL PRIMARY KEY,
                alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
                pollutant VARCHAR(50),
                observed_value FLOAT,
                threshold_crossed FLOAT,
                observation_timestamp TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notification_status VARCHAR(50) DEFAULT 'pending'
            );
        """)

        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_events_alert_observation
            ON alert_events (alert_id, observation_timestamp);
        """)

        logger.info("Schema initialized successfully.")
    except Exception as e:
        sqlstate = getattr(e, "sqlstate", None)
        logger.error("Database initialization failed (%s; SQLSTATE %s)", type(e).__name__, sqlstate or "unavailable")
        raise RuntimeError("Database initialization failed; verify connectivity and existing schema.") from None
    finally:
        if conn is not None:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(init_db())
