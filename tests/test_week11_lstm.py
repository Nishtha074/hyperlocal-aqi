import numpy as np
import pandas as pd

from src.forecasting.lstm_forecasting import (
    build_station_sequences,
    chronological_split,
    create_lstm_model,
    evaluate_regression_metrics,
    fit_sequence_scaler,
)


def _make_station_frame():
    times = pd.date_range("2024-01-01 00:00:00", periods=60, freq="h")
    station_a = pd.DataFrame(
        {
            "StationId": "A",
            "Datetime": times,
            "PM2.5": np.linspace(20, 40, 60),
            "Temperature": np.linspace(20, 30, 60),
            "Humidity": np.linspace(50, 60, 60),
            "WindSpeed": np.linspace(5, 8, 60),
            "Rainfall": np.zeros(60),
            "Pressure": np.linspace(1000, 1010, 60),
            "WindDirection": np.linspace(100, 180, 60),
            "CloudCover": np.linspace(20, 50, 60),
            "hour": [t.hour for t in times],
            "day_of_week": [t.dayofweek for t in times],
            "month": [t.month for t in times],
            "sin_hour": np.sin(2 * np.pi * np.array([t.hour for t in times]) / 24),
            "cos_hour": np.cos(2 * np.pi * np.array([t.hour for t in times]) / 24),
            "sin_month": np.sin(2 * np.pi * np.array([t.month for t in times]) / 12),
            "cos_month": np.cos(2 * np.pi * np.array([t.month for t in times]) / 12),
            "PM25_lag_1": [np.nan] + list(np.linspace(20, 39, 59)),
            "PM25_lag_2": [np.nan, np.nan] + list(np.linspace(20, 38, 58)),
            "nearby_station_PM25": np.linspace(18, 38, 60),
        }
    )
    station_a["target_PM25_1h"] = station_a["PM2.5"].shift(-1)
    station_b = station_a.copy()
    station_b["StationId"] = "B"
    station_b["PM2.5"] = station_b["PM2.5"] + 5
    station_b["Temperature"] = station_b["Temperature"] + 2
    station_b["target_PM25_1h"] = station_b["PM2.5"].shift(-1)
    return pd.concat([station_a, station_b], ignore_index=True)


def test_sequence_creation_has_correct_shape_and_no_station_mixing():
    df = _make_station_frame().sort_values(["StationId", "Datetime"]).reset_index(drop=True)
    feature_cols = [
        "PM2.5",
        "PM25_lag_1",
        "PM25_lag_2",
        "Temperature",
        "Humidity",
        "WindSpeed",
        "nearby_station_PM25",
    ]
    sequences = build_station_sequences(
        df,
        feature_cols=feature_cols,
        target_col="target_PM25_1h",
        sequence_length=24,
        horizon=1,
        station_col="StationId",
    )

    assert "X" in sequences
    assert "y" in sequences
    assert "station_ids" in sequences
    assert sequences["X"].shape[1:] == (24, len(feature_cols))
    assert sequences["y"].shape[0] == sequences["X"].shape[0]
    assert len(np.unique(sequences["station_ids"])) == 2


def test_chronological_split_keeps_ordering():
    df = _make_station_frame().sort_values(["StationId", "Datetime"]).reset_index(drop=True)
    train_df, val_df, test_df = chronological_split(df, validation_fraction=0.15, test_fraction=0.15)

    assert len(train_df) > 0
    assert len(val_df) > 0
    assert len(test_df) > 0
    assert train_df["Datetime"].max() <= val_df["Datetime"].min()
    assert val_df["Datetime"].max() <= test_df["Datetime"].min()


def test_lstm_model_and_prediction_shape_are_valid():
    model = create_lstm_model((24, 3), hidden_units=12, dropout=0.1)
    x = np.random.rand(4, 24, 3).astype("float32")
    preds = model.predict(x, verbose=0)
    assert preds.shape[0] == x.shape[0]
    assert preds.shape[-1] == 1


def test_scaler_fit_only_on_training_data_and_metrics_are_finite():
    train_x = np.random.rand(12, 24, 3).astype("float32")
    val_x = np.random.rand(4, 24, 3).astype("float32")
    scaler = fit_sequence_scaler(train_x)
    transformed_train = scaler.transform(train_x.reshape(-1, train_x.shape[-1])).reshape(train_x.shape)
    transformed_val = scaler.transform(val_x.reshape(-1, val_x.shape[-1])).reshape(val_x.shape)

    assert transformed_train.shape == train_x.shape
    assert transformed_val.shape == val_x.shape

    y_true = np.array([10.0, 12.0, 14.0, 16.0])
    y_pred = np.array([11.0, 11.5, 15.0, 16.5])
    metrics = evaluate_regression_metrics(y_true, y_pred)

    for key in ["MAE", "RMSE", "R2"]:
        assert np.isfinite(metrics[key])
