import joblib
import pandas as pd
import numpy as np
from datetime import datetime
import os

from src.forecasting.aqi import pm25_to_aqi
from src.data.live_weather import get_live_weather

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("live_forecast_gm")

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
model_path = os.path.join(PROJECT_ROOT, "models", "xgboost_gujarat_maharashtra.pkl")
logger.info(f"Loading model from: {model_path}")
model = joblib.load(model_path)
logger.info(f"Model loaded successfully. Expected {len(model.feature_names_in_)} features.")

# City coordinates mapping to estimate station locations
CITY_COORDS = {
    'Ahmedabad': (23.0225, 72.5714),
    'Ankleshwar': (21.6264, 73.0152),
    'Gandhinagar': (23.2156, 72.6369),
    'Nandesari': (22.4042, 73.0991),
    'Vapi': (20.3893, 72.9106),
    'Vatva': (22.9511, 72.6074),
    'Aurangabad': (19.8762, 75.3433),
    'Chandrapur': (19.9615, 79.2961),
    'Kalyan': (19.2403, 73.1305),
    'Mumbai': (19.0760, 72.8777),
    'Nagpur': (21.1458, 79.0882),
    'Nashik': (19.9975, 73.7898),
    'Navi Mumbai': (19.0330, 73.0297),
    'Pune': (18.5204, 73.8567),
    'Solapur': (17.6599, 75.9064),
    'Thane': (19.2183, 72.9781),
    'Vadodara': (22.3072, 73.1812),
    'Surat': (21.1702, 72.8311)
}

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2.0)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

station_city_map = {
    'MH005': 'Mumbai', 'MH006': 'Mumbai', 'MH007': 'Pune', 'MH008': 'Pune',
    'MH009': 'Nagpur', 'MH010': 'Nagpur', 'MH011': 'Thane', 'MH012': 'Navi Mumbai',
    'MH013': 'Kalyan', 'MH014': 'Aurangabad', 'GJ001': 'Ahmedabad',
}

def find_nearest_station(lat, lon):
    min_dist = float('inf')
    nearest_station = None

    # We only care about stations that the model actually knows about
    model_stations = [f.replace('StationId_', '') for f in model.feature_names_in_ if f.startswith('StationId_')]

    for st_id in model_stations:
        city = station_city_map.get(st_id)
        if city in CITY_COORDS:
            st_lat, st_lon = CITY_COORDS[city]
            dist = haversine_distance(lat, lon, st_lat, st_lon)
            if dist < min_dist:
                min_dist = dist
                nearest_station = st_id

    if nearest_station is None:
        return model_stations[0] if model_stations else "Unknown"

    return nearest_station

def predict_pm25(pm25, lat, lon):
    features = {}

    for col in model.feature_names_in_:
        features[col] = 0

    features["PM2.5"] = pm25
    features["PM25_lag_1"] = pm25
    features["PM25_lag_2"] = pm25 * 0.98
    features["PM25_lag_3"] = pm25 * 0.96
    features["PM25_lag_6"] = pm25 * 0.92
    features["PM25_lag_12"] = pm25 * 0.85
    features["PM25_lag_24"] = pm25 * 0.80

    nearest_station = find_nearest_station(lat, lon)
    station_col = f"StationId_{nearest_station}"
    if station_col in features:
        features[station_col] = 1

    features["Latitude"] = lat
    features["Longitude"] = lon

    weather_source = "Live Open-Meteo"
    try:
        weather = get_live_weather(lat, lon)
    except Exception as e:
        logger.warning(f"Weather API failed: {e}. Using default weather.")
        weather_source = "Default values (API unreachable)"
        weather = {
            "temperature": 30,
            "humidity": 60,
            "wind_speed": 5,
            "pressure": 1013,
        }

    now = datetime.now()

    features["hour"] = now.hour
    features["day"] = now.day
    features["month"] = now.month
    features["day_of_week"] = now.weekday()
    features["is_weekend"] = 1 if now.weekday() >= 5 else 0

    features["sin_hour"] = np.sin(2 * np.pi * now.hour / 24)
    features["cos_hour"] = np.cos(2 * np.pi * now.hour / 24)
    features["sin_month"] = np.sin(2 * np.pi * now.month / 12)
    features["cos_month"] = np.cos(2 * np.pi * now.month / 12)

    features["Temperature"] = weather["temperature"]
    features["Humidity"] = weather["humidity"]
    features["WindSpeed"] = weather["wind_speed"]
    features["Pressure"] = weather["pressure"]
    features["Rainfall"] = 0
    features["CloudCover"] = 0
    features["WindDirection"] = 180

    features["temp_roll_3h"] = weather["temperature"]
    features["temp_roll_6h"] = weather["temperature"]
    features["humidity_roll_3h"] = weather["humidity"]
    features["humidity_roll_6h"] = weather["humidity"]
    features["wind_speed_roll_3h"] = weather["wind_speed"]
    features["wind_speed_roll_6h"] = weather["wind_speed"]

    features["pm25_roll_3h"] = (features["PM25_lag_1"] + features["PM25_lag_2"] + features["PM25_lag_3"]) / 3
    features["pm25_roll_6h"] = (pm25 + features["PM25_lag_1"] + features["PM25_lag_2"] + features["PM25_lag_3"] + features["PM25_lag_6"]) / 5

    features["temp_change_1h"] = 0
    features["humidity_change_1h"] = 0
    features["wind_speed_change_1h"] = 0

    features["nearby_station_PM25"] = pm25
    features["no2_satellite"] = 0

    X = pd.DataFrame([features])
    # Keep only features model expects in EXACT order
    X = X[model.feature_names_in_]

    logger.info(f"Running predict_pm25 for Station={nearest_station}")
    logger.info(f"Weather source: {weather_source}")
    logger.info(f"Input feature count matches: {len(X.columns) == len(model.feature_names_in_)} (Expected {len(model.feature_names_in_)}, Got {len(X.columns)})")

    try:
        prediction = float(model.predict(X)[0])
        logger.info(f"model.predict() executed successfully. Output: {prediction:.2f}")
        return prediction
    except Exception as e:
        logger.error(f"model.predict() failed: {e}")
        raise

def get_live_forecast(pm25, lat, lon):
    pm25_1h = predict_pm25(pm25, lat, lon)
    pm25_3h = predict_pm25(pm25_1h, lat, lon)
    pm25_6h = predict_pm25(pm25_3h, lat, lon)

    return {
        1: pm25_to_aqi(pm25_1h),
        3: pm25_to_aqi(pm25_3h),
        6: pm25_to_aqi(pm25_6h),
    }

if __name__ == "__main__":
    print("Testing Live Forecast GM...")
    coords = {
        'Mumbai': (19.0760, 72.8777),
        'Pune': (18.5204, 73.8567),
        'Ahmedabad': (23.0225, 72.5714),
        'Vadodara': (22.3072, 73.1812),
        'Surat': (21.1702, 72.8311),
        'Nagpur': (21.1458, 79.0882)
    }
    for city, (lat, lon) in coords.items():
        print(f"\n{city} (Lat: {lat}, Lon: {lon}):")
        forecast = get_live_forecast(45.0, lat, lon)
        print(forecast)
