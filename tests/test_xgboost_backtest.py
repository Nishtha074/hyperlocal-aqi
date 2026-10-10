import pandas as pd

from scripts.backtest_xgboost import attach_actual_targets, split_chronologically


def test_exact_horizon_targets_require_measured_origin_and_future_timestamp():
    times = pd.date_range("2024-01-01", periods=5, freq="h")
    features = pd.DataFrame(
        {
            "StationId": ["A"] * 4,
            "Datetime": [times[0], times[1], times[2], times[3]],
            "feature": [1.0, 2.0, 3.0, 4.0],
        }
    )
    observations = pd.DataFrame(
        {
            "StationId": ["A"] * 5,
            "Datetime": times,
            "PM2.5": [10.0, 11.0, None, 13.0, 14.0],
        }
    )

    targets = attach_actual_targets(features, observations, horizon_hours=1)

    assert targets[["Datetime", "target_datetime", "actual_pm25"]].to_dict("records") == [
        {
            "Datetime": times[0],
            "target_datetime": times[1],
            "actual_pm25": 11.0,
        },
        {
            "Datetime": times[3],
            "target_datetime": times[4],
            "actual_pm25": 14.0,
        },
    ]


def test_chronological_split_purges_training_targets_crossing_test_start():
    cutoff = pd.Timestamp("2024-01-01 05:00:00")
    rows = pd.DataFrame(
        {
            "Datetime": pd.to_datetime(
                ["2024-01-01 02:00", "2024-01-01 03:00", "2024-01-01 05:00"]
            ),
            "target_datetime": pd.to_datetime(
                ["2024-01-01 04:00", "2024-01-01 05:00", "2024-01-01 06:00"]
            ),
        }
    )

    train, test = split_chronologically(rows, cutoff)

    assert train.index.tolist() == [0]
    assert test.index.tolist() == [2]
    assert (train["target_datetime"] < cutoff).all()