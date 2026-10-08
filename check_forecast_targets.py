# 
import pandas as pd

df = pd.read_csv("data/processed/mumbai_feature_engineered.csv")

cols = [
    "Datetime",
    "PM2.5",
    "target_PM25_1h",
    "target_PM25_3h",
    "target_PM25_6h",
]

print(df[cols].tail(10))