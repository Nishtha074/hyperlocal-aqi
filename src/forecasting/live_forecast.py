from folium import features
import joblib
import pandas as pd

from src.forecasting.aqi import pm25_to_aqi
from src.data.live_weather import get_live_weather

from datetime import datetime
import numpy as np

model = joblib.load("models/xgboost_with_satellite.pkl")


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
    features["StationId_MH010"] = 1

    features["Latitude"] = lat
    features["Longitude"] = lon

    try:
        weather = get_live_weather(lat, lon)
    except Exception:
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

    features["is_raining"] = 0
    features["rain_roll_3h"] = 0

    features["temp_roll_3h"] = weather["temperature"]
    features["temp_roll_6h"] = weather["temperature"]

    features["humidity_roll_3h"] = weather["humidity"]
    features["humidity_roll_6h"] = weather["humidity"]

    features["wind_speed_roll_3h"] = weather["wind_speed"]
    features["wind_speed_roll_6h"] = weather["wind_speed"]

    features["pm25_roll_3h"] = (
        features["PM25_lag_1"]
        + features["PM25_lag_2"]
        + features["PM25_lag_3"]
    ) / 3

    features["pm25_roll_6h"] = (
        pm25
        + features["PM25_lag_1"]
        + features["PM25_lag_2"]
        + features["PM25_lag_3"]
        + features["PM25_lag_6"]
    ) / 5

    features["temp_change_1h"] = 0
    features["humidity_change_1h"] = 0
    features["wind_speed_change_1h"] = 0

    features["nearby_station_PM25"] = pm25
    features["no2_satellite"] = 0

    print(
    features["StationId_MH007"],
    features["StationId_MH008"],
    features["StationId_MH009"],
    features["StationId_MH010"],
    features["StationId_MH011"],
    features["StationId_MH014"],
)

    X = pd.DataFrame([features])

    return float(model.predict(X)[0])


def get_live_forecast(pm25, lat, lon):

    pm25_1h = predict_pm25(pm25, lat, lon)

    pm25_3h = predict_pm25(pm25_1h, lat, lon)

    pm25_6h = predict_pm25(pm25_3h, lat, lon)

    print("1h PM2.5 =", pm25_1h)
    print("3h PM2.5 =", pm25_3h)
    print("6h PM2.5 =", pm25_6h)


    return {
        1: pm25_to_aqi(pm25_1h),
        3: pm25_to_aqi(pm25_3h),
        6: pm25_to_aqi(pm25_6h),
    }
