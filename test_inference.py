import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

print("--- TESTING DATABASE UNAVAILABLE (MH009) ---")
response = client.get("/api/forecast/MH009")
print(f"Status: {response.status_code}")
data = response.json()
print("Response JSON:")
print(data)
print(f"Database unavailable flag: {data.get('is_db_unavailable')}")
print(f"Demo fallback flag: {data.get('is_demo_fallback')}")
print(f"Note: {data.get('note')}")

print("\n--- TESTING PREDICTION LOGIC DIRECTLY ---")
from src.forecasting.live_forecast_gm import predict_pm25, model, CITY_COORDS

# MH009 is Nagpur
lat, lon = CITY_COORDS['Nagpur']
print(f"Testing direct prediction for Nagpur (lat={lat}, lon={lon}) with current_pm25 = 75.0")
try:
    pred = predict_pm25(75.0, lat, lon)
    print(f"Prediction successful! Value: {pred:.2f}")
except Exception as e:
    print(f"Prediction failed! Error: {e}")
