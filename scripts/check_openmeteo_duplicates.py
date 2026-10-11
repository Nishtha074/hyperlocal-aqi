
import asyncio
import os

import asyncpg
from dotenv import load_dotenv

load_dotenv()


async def main():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        duplicates = await conn.fetch("""
            SELECT station, last_update, COUNT(*) AS record_count
            FROM cpcb_readings
            WHERE source = 'Open-Meteo'
            GROUP BY station, last_update
            HAVING COUNT(*) > 1
            ORDER BY record_count DESC
            LIMIT 20
        """)

        if duplicates:
            print("Duplicates found:")
            for row in duplicates:
                print(dict(row))
        else:
            print("No duplicate Open-Meteo observations found.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
