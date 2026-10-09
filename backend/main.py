from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncpg, joblib, os, numpy as np, pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="Hyperlocal AQI API")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"]
)

DB_URL = os.getenv("DATABASE_URL")

# Make model loading robust in case they aren't generated yet
try:
    model_1h = joblib.load("models/xgboost_pm25_1h.pkl")
    model_3h = joblib.load("models/xgboost_pm25_3h.pkl")
    model_6h = joblib.load("models/xgboost_pm25_6h.pkl")
except:
    model_1h = None
    model_3h = None
    model_6h = None

async def get_conn():
    return await asyncpg.connect(DB_URL)

@app.get("/")
def root():
    return {"status": "ok", "service": "Hyperlocal AQI API"}

@app.get("/api/current")
async def current():
    try:
        conn = await get_conn()
        rows = await conn.fetch("""
            SELECT DISTINCT ON (station) station, city, latitude, longitude,
                   pm25, pm10, no2, so2, co, ozone, fetched_at
            FROM cpcb_readings
            ORDER BY station, fetched_at DESC
        """)
        await conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Database error in current(): {e}")
        now = datetime.now().isoformat()
        return [
            {"station": "Bandra, Mumbai", "city": "Mumbai", "latitude": 19.0565, "longitude": 72.8362, "pm25": 85.2, "pm10": 110.5, "no2": 30.1, "fetched_at": now, "is_demo": True},
            {"station": "Shivajinagar, Pune", "city": "Pune", "latitude": 18.5308, "longitude": 73.8474, "pm25": 65.4, "pm10": 80.2, "no2": 20.4, "fetched_at": now, "is_demo": True},
            {"station": "Maninagar, Ahmedabad", "city": "Ahmedabad", "latitude": 22.9961, "longitude": 72.6025, "pm25": 105.1, "pm10": 140.3, "no2": 45.6, "fetched_at": now, "is_demo": True},
            {"station": "Alkapuri, Vadodara", "city": "Vadodara", "latitude": 22.3117, "longitude": 73.1670, "pm25": 92.5, "pm10": 120.1, "no2": 35.8, "fetched_at": now, "is_demo": True},
            {"station": "Varachha, Surat", "city": "Surat", "latitude": 21.2163, "longitude": 72.8647, "pm25": 78.9, "pm10": 95.4, "no2": 25.2, "fetched_at": now, "is_demo": True},
            {"station": "Civil Lines, Nagpur", "city": "Nagpur", "latitude": 21.1540, "longitude": 79.0760, "pm25": 55.6, "pm10": 70.1, "no2": 15.3, "fetched_at": now, "is_demo": True},
        ]

@app.get("/api/station/{station}/history")
async def station_history(station: str, hours: int = 24):
    conn = await get_conn()
    rows = await conn.fetch("""
        SELECT pm25, pm10, no2, fetched_at FROM cpcb_readings
        WHERE station = $1 ORDER BY fetched_at DESC LIMIT $2
    """, station, hours)
    await conn.close()
    return [dict(r) for r in rows][::-1]

def build_features(history_df, weather_df):
    latest = history_df.iloc[-1]
    feat = {
        "pm25_lag1": history_df["pm25"].iloc[-1] if len(history_df) > 0 else 0,
        "pm25_lag2": history_df["pm25"].iloc[-2] if len(history_df) > 1 else 0,
        "pm25_lag3": history_df["pm25"].iloc[-3] if len(history_df) > 2 else 0,
        "hour": datetime.now().hour,
        "day_of_week": datetime.now().weekday(),
        "temperature": weather_df["temperature"].iloc[-1] if len(weather_df) > 0 else 25,
        "humidity": weather_df["relative_humidity"].iloc[-1] if len(weather_df) > 0 else 60,
        "wind_speed": weather_df["wind_speed"].iloc[-1] if len(weather_df) > 0 else 5,
    }
    return pd.DataFrame([feat])

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.forecasting.live_forecast_gm import predict_pm25, CITY_COORDS, station_city_map

@app.get("/api/forecast/{station}")
async def forecast(station: str):
    try:
        conn = await get_conn()
        # Need latitude and longitude as well for predict_pm25
        hist = await conn.fetch("""
            SELECT pm25, latitude, longitude, fetched_at FROM cpcb_readings
            WHERE station = $1 ORDER BY fetched_at DESC LIMIT 1
        """, station)
        await conn.close()
    except Exception as e:
        print(f"Database error in forecast(): {e}")
        hist = None

    if not hist or len(hist) == 0:
        # Fallback to ML model but with default PM2.5 starting value
        curr = 65.4
        # Determine lat/lon from station ID if possible
        city = station_city_map.get(station)
        lat, lon = CITY_COORDS.get(city, (19.0760, 72.8777))

        is_demo_fallback = False
        note = "Database unavailable. Forecast generated using XGBoost model from a baseline starting PM2.5 (65.4) and live weather."

        try:
            pred_1h = predict_pm25(curr, lat, lon)
            pred_3h = predict_pm25(pred_1h, lat, lon)
            pred_6h = predict_pm25(pred_3h, lat, lon)
        except Exception as e:
            print(f"Prediction error in fallback: {e}")
            pred_1h = curr * 1.05
            pred_3h = curr * 1.10
            pred_6h = curr * 1.15
            is_demo_fallback = True
            note = "Database unavailable and ML inference failed. Returning demo percentages."

        margin = max(5, pred_1h * 0.15)
        return {
            "station": station,
            "current_pm25": curr,
            "forecast": {
                "1h": {"value": round(pred_1h, 1), "range": [round(pred_1h - margin, 1), round(pred_1h + margin, 1)]},
                "3h": {"value": round(pred_3h, 1), "range": [round(pred_3h - margin * 1.3, 1), round(pred_3h + margin * 1.3, 1)]},
                "6h": {"value": round(pred_6h, 1), "range": [round(pred_6h - margin * 1.6, 1), round(pred_6h + margin * 1.6, 1)]},
            },
            "generated_at": datetime.now().isoformat(),
            "is_db_unavailable": True,
            "is_demo_fallback": is_demo_fallback,
            "note": note
        }

    row = dict(hist[0])
    curr = float(row["pm25"])
    lat = float(row["latitude"]) if row["latitude"] else 19.0760
    lon = float(row["longitude"]) if row["longitude"] else 72.8777

    try:
        pred_1h = predict_pm25(curr, lat, lon)
        pred_3h = predict_pm25(pred_1h, lat, lon)
        pred_6h = predict_pm25(pred_3h, lat, lon)
        is_demo_fallback = False
        note = "Forecast generated successfully using XGBoost model."
    except Exception as e:
        print(f"Prediction error: {e}")
        pred_1h = curr * 1.05
        pred_3h = curr * 1.10
        pred_6h = curr * 1.15
        is_demo_fallback = True
        note = "ML inference failed. Returning demo percentages."

    margin = max(5, pred_1h * 0.15)

    result = {
        "station": station,
        "current_pm25": curr,
        "forecast": {
            "1h": {"value": round(pred_1h, 1), "range": [round(pred_1h - margin, 1), round(pred_1h + margin, 1)]},
            "3h": {"value": round(pred_3h, 1), "range": [round(pred_3h - margin * 1.3, 1), round(pred_3h + margin * 1.3, 1)]},
            "6h": {"value": round(pred_6h, 1), "range": [round(pred_6h - margin * 1.6, 1), round(pred_6h + margin * 1.6, 1)]},
        },
        "generated_at": datetime.now().isoformat(),
        "is_db_unavailable": False,
        "is_demo_fallback": is_demo_fallback,
        "note": note
    }

    try:
        conn = await get_conn()
        for horizon, val in [("1h", pred_1h), ("3h", pred_3h), ("6h", pred_6h)]:
            await conn.execute("""
                INSERT INTO forecasts (station, horizon, predicted_pm25, lower_bound, upper_bound, model_used)
                VALUES ($1,$2,$3,$4,$5,'xgboost_gm')
            """, station, horizon, val, val - margin, val + margin)
        await conn.close()
    except Exception as e:
        print(f"Error saving forecast: {e}")

    return result

@app.get("/api/heatmap")
async def heatmap():
    conn = await get_conn()
    rows = await conn.fetch("""
        SELECT DISTINCT ON (station) station, latitude, longitude, pm25
        FROM cpcb_readings ORDER BY station, fetched_at DESC
    """)
    await conn.close()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["longitude"], r["latitude"]]},
                "properties": {"station": r["station"], "pm25": r["pm25"]}
            } for r in rows if r["pm25"] is not None
        ]
    }

def calculate_risk(pm25, profile):
    base_thresholds = {"adult": 100, "elderly": 70, "child": 60}
    sensitivity_adjust = {"none": 0, "asthma": -20, "heart": -20, "pregnant": -15}
    threshold = base_thresholds.get(profile.get("age_group", "adult"), 100)
    threshold += sensitivity_adjust.get(profile.get("sensitivity", "none"), 0)

    if pm25 <= threshold * 0.5:
        level, advice = "Low", "Air quality is fine for your profile. Normal activity OK."
    elif pm25 <= threshold:
        level, advice = "Moderate", "Consider limiting prolonged outdoor exertion."
    elif pm25 <= threshold * 1.5:
        level, advice = "High", "Reduce outdoor activity. Wear a mask if going out."
    else:
        level, advice = "Severe", "Avoid outdoor activity. Keep windows closed."

    return {"risk_level": level, "advice": advice, "threshold_used": threshold}

@app.post("/api/risk-assessment")
async def risk_assessment(profile: dict):
    station = profile.get("station", "Katraj Dairy, Pune - MPCB")
    conn = await get_conn()
    row = await conn.fetchrow("""
        SELECT pm25 FROM cpcb_readings WHERE station = $1
        ORDER BY fetched_at DESC LIMIT 1
    """, station)
    await conn.close()
    if not row or row["pm25"] is None:
        raise HTTPException(404, "No current data")
    risk = calculate_risk(row["pm25"], profile)
    risk["current_pm25"] = row["pm25"]
    return risk

@app.get("/api/model-metrics")
async def model_metrics():
    conn = await get_conn()
    rows = await conn.fetch("SELECT * FROM model_metrics ORDER BY evaluated_at DESC LIMIT 10")
    await conn.close()
    return [dict(r) for r in rows]
