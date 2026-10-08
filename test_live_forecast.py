from src.forecasting.live_forecast import get_live_forecast

forecast = get_live_forecast(
    pm25=51,
    lat=22.2994,
    lon=73.2081
)

print(forecast)