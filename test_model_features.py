# # test_model_features.py

# import joblib

# model = joblib.load("models/xgboost_with_satellite.pkl")

# for i, f in enumerate(model.feature_names_in_):
#     print(i, f)



import pandas as pd

df = pd.read_csv("data/features/model_with_satellite.csv")

print(df["target_PM25_1h"].describe())



print(df["target_PM25_1h"].quantile([0.5,0.75,0.9,0.95,0.99]))

