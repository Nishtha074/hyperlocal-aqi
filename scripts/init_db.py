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
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
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
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
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
