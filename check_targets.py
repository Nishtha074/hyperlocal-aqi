import pandas as pd

df = pd.read_csv("data/processed/mumbai_feature_engineered.csv")

cols = [
    "AQI","PM2.5",
    "target_1h","target_3h","target_6h",
    "target_PM25_1h","target_PM25_3h","target_PM25_6h"
]

for c in cols:
    print(c, "=", df[c].dropna().iloc[-1])