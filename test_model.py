# # import joblib

# # model = joblib.load("models/xgboost_with_satellite.pkl")

# # print(type(model))
# # print(model.feature_names_in_)

# from src.forecasting.live_forecast import predict_pm25

# features["StationId_MH010"] = 1

# for pm25 in [10, 20, 30, 40, 50, 60, 80, 100]:
#     pred = predict_pm25(pm25, 19.0760, 72.8777)
#     print(pm25, "->", pred)

from src.forecasting.live_forecast import predict_pm25

print("Mumbai :", predict_pm25(51, 19.0760, 72.8777))
print("Vadodara:", predict_pm25(51, 22.2994, 73.2081))