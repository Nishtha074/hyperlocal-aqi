
import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()


async def main():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    conn = await asyncpg.connect(database_url)

    try:
        rows = await conn.fetch("""
            SELECT station, city, pm25, pm10, last_update, source
            FROM cpcb_readings
            WHERE source = 'Open-Meteo'
            ORDER BY last_update DESC
            LIMIT 10
        """)

        print(f"Open-Meteo records found: {len(rows)}")

        for row in rows:
            print(dict(row))

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
