import joblib
import pandas as pd

model = joblib.load("models/xgboost_with_satellite.pkl")

features = {}

for col in model.feature_names_in_:
    features[col] = 0

features["PM2.5"] = 51
features["PM25_lag_1"] = 51
features["PM25_lag_2"] = 51
features["PM25_lag_3"] = 51
features["PM25_lag_6"] = 51
features["PM25_lag_12"] = 51
features["PM25_lag_24"] = 51

X = pd.DataFrame([features])

prediction = model.predict(X)

print("Predicted PM2.5 =", prediction[0])