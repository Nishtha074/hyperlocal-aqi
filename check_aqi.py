from src.forecasting.aqi import pm25_to_aqi

tests = [30, 60, 90, 120]

for value in tests:
    print(value, "PM2.5 -> AQI", pm25_to_aqi(value))
    print("1.9 PM2.5 -> AQI", pm25_to_aqi(1.9))