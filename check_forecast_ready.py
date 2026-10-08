import pandas as pd

df = pd.read_csv("data/processed/mumbai_feature_engineered.csv")

forecast_ready = df.dropna(
    subset=[
        "target_PM25_1h",
        "target_PM25_3h",
        "target_PM25_6h",
    ]
)

print("Rows:", len(forecast_ready))

latest = forecast_ready.iloc[-1]

print("Datetime =", latest["Datetime"])
print("PM2.5 =", latest["PM2.5"])
print("1h =", latest["target_PM25_1h"])
print("3h =", latest["target_PM25_3h"])
print("6h =", latest["target_PM25_6h"])