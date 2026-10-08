import joblib

model = joblib.load("models/xgboost_with_satellite.pkl")

print(type(model))

try:
    print(model.feature_names_in_)
except Exception as e:
    print("No feature names:", e)