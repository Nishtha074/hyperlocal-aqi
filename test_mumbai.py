from src.forecasting.live_forecast import predict_pm25

for pm25 in [20, 40, 60, 80]:
    pred = predict_pm25(pm25, 19.0863, 72.8888)
    print(pm25, "->", pred)