import pandas as pd
import joblib

model = joblib.load("models/xgboost_with_satellite.pkl")

row = {
    col: 0
    for col in model.feature_names_in_
}

row["PM2.5"] = 51
row["PM25_lag_1"] = 51
row["PM25_lag_2"] = 51
row["PM25_lag_3"] = 51
row["PM25_lag_6"] = 51
row["PM25_lag_12"] = 51
row["PM25_lag_24"] = 51

row["pm25_roll_3h"] = 51
row["pm25_roll_6h"] = 51
row["nearby_station_PM25"] = 51

row["StationId_MH010"] = 1

X = pd.DataFrame([row])

print(model.predict(X)[0])