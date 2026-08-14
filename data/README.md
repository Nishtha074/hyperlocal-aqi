# Data Sources — Week 2 Status

| Source | Status | Notes |
|--------|--------|-------|
| CPCB (data.gov.in) | ✅ Live, auto-logging hourly | 6 Pune stations (IITM + MPCB). PM2.5, PM10, NO2, SO2, CO, O3, NH3. Required custom User-Agent header to avoid 502 errors. |
| Open-Meteo weather | ✅ Live, auto-logging hourly | Pune coordinates (18.5204, 73.8567). No API key needed. Temp, humidity, wind, pressure, cloud cover. |
| OpenAQ | ✅ Live, auto-logging hourly | 19 Pune-area stations, used as backup/cross-validation. Some sensors report stale data (last reading from 2018 or 2025 for a few stations) — will filter by recency during cleaning (Week 3). |
| Kaggle historical (2015–2020) | Not yet downloaded | Planned for early EDA/prototyping only, not final source. |

## Pipeline setup
- All three sources collected via `scripts/auto_collect.py`, run every hour in a single Python loop (`time.sleep(3600)`).
- Raw data saved to `data/raw/{cpcb,weather,openaq}/`.
- Started logging: 14-08-2026.

## Known data quality notes for Week 3 cleaning
- OpenAQ: several stations have stale/outdated timestamps — need a recency filter.
- CPCB: some pollutant readings return `NA` when a sensor is temporarily offline — needs missing-value handling.