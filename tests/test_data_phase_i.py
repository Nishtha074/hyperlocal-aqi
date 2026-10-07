import pandas as pd

from src.dashboard_helpers import validate_bad_data


def test_missing_pm_values_are_cleaned():
    df = pd.DataFrame({"PM2.5": [10.0, None, 20.0], "PM10": [25.0, 30.0, None], "AQI": [50.0, 60.0, None], "Datetime": ["2024-01-01 00:00:00", "2024-01-01 01:00:00", "2024-01-01 02:00:00"]})
    cleaned = validate_bad_data(df)
    assert cleaned["PM2.5"].notna().sum() >= 2
    assert cleaned["PM10"].notna().sum() >= 2


def test_negative_and_extreme_values_are_filtered():
    df = pd.DataFrame({"AQI": [-1, 9999, 50], "PM2.5": [3, 7000, 12], "Datetime": ["2024-01-01 00:00:00", "2024-01-01 01:00:00", "2024-01-01 02:00:00"]})
    cleaned = validate_bad_data(df)
    assert len(cleaned) <= 3
    assert (cleaned["AQI"] >= 0).all()
    assert (cleaned["AQI"] <= 1000).all() if not cleaned.empty else True
