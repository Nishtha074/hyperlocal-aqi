import pandas as pd

from src.forecasting.forecast_evaluation import build_comparison_table


def test_build_comparison_table_keeps_horizon_alignment_and_sequence_note():
    xgb_df = pd.DataFrame(
        [{"Model": "XGBoost", "MAE": 4.25, "RMSE": 11.30, "R2": 0.30}]
    )
    lstm_df = pd.DataFrame(
        [
            {"horizon": 1, "MAE": 5.36, "RMSE": 8.49, "R2": 0.21, "MAPE": 93.45},
            {"horizon": 3, "MAE": 6.86, "RMSE": 9.71, "R2": -0.03, "MAPE": 125.47},
            {"horizon": 6, "MAE": 8.20, "RMSE": 10.79, "R2": -0.28, "MAPE": 153.81},
        ]
    )

    comparison = build_comparison_table(xgb_df, lstm_df)

    assert {"XGBoost", "LSTM"}.issubset(set(comparison["Model"]))
    assert comparison["horizon"].notna().all()
    assert comparison["sequence_window_note"].str.contains("24-hour|sequence|window", case=False).any()
    assert (comparison[comparison["Model"] == "XGBoost"]["horizon"] == 1).all()
    assert set(comparison[comparison["Model"] == "LSTM"]["horizon"]) == {1, 3, 6}
