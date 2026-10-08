import joblib
import pandas as pd

model = joblib.load("models/xgboost_with_satellite.pkl")

features = {}

for col in model.feature_names_in_:
    features[col] = 0

features["PM2.5"] = 52.9
features["PM25_lag_1"] = 52.9
features["PM25_lag_2"] = 52.9
features["PM25_lag_3"] = 52.9
features["PM25_lag_6"] = 52.9
features["PM25_lag_12"] = 52.9
features["PM25_lag_24"] = 52.9

X = pd.DataFrame([features])

print(model.predict(X))