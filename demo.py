import pandas as pd

df = pd.read_csv("data/processed/mumbai_feature_engineered.csv")

print("AQI =", df["AQI"].dropna().iloc[-1])
print("PM2.5 =", df["PM2.5"].dropna().iloc[-1])

print("target_1h =", df["target_1h"].dropna().iloc[-1])
print("target_3h =", df["target_3h"].dropna().iloc[-1])
print("target_6h =", df["target_6h"].dropna().iloc[-1])

print("target_PM25_1h =", df["target_PM25_1h"].dropna().iloc[-1])
print("target_PM25_3h =", df["target_PM25_3h"].dropna().iloc[-1])
print("target_PM25_6h =", df["target_PM25_6h"].dropna().iloc[-1])

