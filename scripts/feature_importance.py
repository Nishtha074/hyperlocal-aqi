import joblib

model = joblib.load("models/xgboost_with_satellite.pkl")

importance = model.feature_importances_

for name, score in sorted(
    zip(model.feature_names_in_, importance),
    key=lambda x: x[1],
    reverse=True
)[:15]:
    print(name, score)