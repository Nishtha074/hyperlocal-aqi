import os
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from tensorflow.keras import Sequential
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.layers import Dense, Dropout, LSTM
from tensorflow.keras.optimizers import Adam

DEFAULT_SEQUENCE_LENGTH = 24
DEFAULT_FEATURE_COLUMNS = [
    "PM2.5",
    "PM25_lag_1",
    "PM25_lag_2",
    "PM25_lag_3",
    "PM25_lag_6",
    "PM25_lag_12",
    "PM25_lag_24",
    "Temperature",
    "Humidity",
    "WindSpeed",
    "Rainfall",
    "Pressure",
    "CloudCover",
    "WindDirection",
    "hour",
    "day_of_week",
    "month",
    "sin_hour",
    "cos_hour",
    "sin_month",
    "cos_month",
    "nearby_station_PM25",
]
TARGET_MAP = {
    1: "target_PM25_1h",
    3: "target_PM25_3h",
    6: "target_PM25_6h",
}


@dataclass
class SequenceDataset:
    X: np.ndarray
    y: np.ndarray
    timestamps: np.ndarray
    station_ids: np.ndarray


def load_forecasting_data(data_path: str = "data/processed/mumbai_feature_engineered.csv") -> pd.DataFrame:
    """Load and validate the official Week 10 forecasting dataset."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Forecasting dataset not found at {data_path}")

    df = pd.read_csv(data_path)
    if "StationId" not in df.columns or "Datetime" not in df.columns or "PM2.5" not in df.columns:
        raise ValueError("Expected StationId, Datetime, and PM2.5 columns in forecast input data.")

    df = df.copy()
    df["Datetime"] = pd.to_datetime(df["Datetime"])
    df = df.sort_values(["StationId", "Datetime"]).reset_index(drop=True)
    return df


def validate_forecasting_data(df: pd.DataFrame) -> Dict[str, object]:
    """Report schema checks and ordering validity for the forecasting dataset."""
    checks: Dict[str, object] = {
        "required_columns_present": all(col in df.columns for col in ["StationId", "Datetime", "PM2.5"]),
        "duplicate_timestamps": bool(df.duplicated(subset=["StationId", "Datetime"]).any()),
        "has_missing_values": bool(df.isnull().any().any()),
        "station_count": int(df["StationId"].nunique()),
        "row_count": int(len(df)),
        "datetime_min": df["Datetime"].min() if "Datetime" in df.columns else None,
        "datetime_max": df["Datetime"].max() if "Datetime" in df.columns else None,
    }
    for horizon in [1, 3, 6]:
        target_col = TARGET_MAP[horizon]
        checks[f"target_{horizon}h_present"] = target_col in df.columns
    return checks


def ensure_forecast_targets(df: pd.DataFrame, horizons: Sequence[int] = (1, 3, 6)) -> pd.DataFrame:
    """Create target_PM25_hh columns if missing, using per-station hourly alignment."""
    working = df.copy()
    working = working.sort_values(["StationId", "Datetime"]).reset_index(drop=True)
    for horizon in horizons:
        target_col = TARGET_MAP[horizon]
        if target_col in working.columns:
            continue
        rows = []
        for station_id, station_df in working.groupby("StationId", sort=True):
            station_df = station_df.sort_values("Datetime").copy()
            station_df = station_df.set_index("Datetime")
            full_index = pd.date_range(start=station_df.index.min(), end=station_df.index.max(), freq="h")
            station_df = station_df.reindex(full_index)
            station_df["StationId"] = station_id
            station_df = station_df.reset_index().rename(columns={"index": "Datetime"})
            station_df[target_col] = station_df["PM2.5"].shift(-horizon)
            rows.append(station_df)
        if rows:
            working = pd.concat(rows, ignore_index=True)
    return working.sort_values(["StationId", "Datetime"]).reset_index(drop=True)


def chronological_split(
    df: pd.DataFrame,
    validation_fraction: float = 0.15,
    test_fraction: float = 0.15,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split on time so train precedes validation precedes test without future leakage."""
    if not 0.0 < validation_fraction < 1.0 or not 0.0 < test_fraction < 1.0:
        raise ValueError("Validation and test fractions must be between 0 and 1.")
    if validation_fraction + test_fraction >= 1.0:
        raise ValueError("Validation plus test fractions must be less than 1.0.")

    working = df.copy().sort_values("Datetime").reset_index(drop=True)
    unique_times = pd.Index(sorted(working["Datetime"].unique()))
    total = len(unique_times)
    train_end = int(total * (1.0 - validation_fraction - test_fraction))
    val_end = int(total * (1.0 - test_fraction))

    train_times = unique_times[:train_end]
    val_times = unique_times[train_end:val_end]
    test_times = unique_times[val_end:]

    train_df = working[working["Datetime"].isin(train_times)].copy().reset_index(drop=True)
    val_df = working[working["Datetime"].isin(val_times)].copy().reset_index(drop=True)
    test_df = working[working["Datetime"].isin(test_times)].copy().reset_index(drop=True)

    if len(train_df) == 0 or len(val_df) == 0 or len(test_df) == 0:
        raise ValueError("Chronological split produced an empty partition; adjust validation/test fractions.")

    return train_df, val_df, test_df


def _select_feature_columns(df: pd.DataFrame, feature_cols: Sequence[str] | None = None) -> List[str]:
    if feature_cols is None:
        feature_cols = list(DEFAULT_FEATURE_COLUMNS)
    available = [col for col in feature_cols if col in df.columns]
    missing = [col for col in feature_cols if col not in df.columns]
    if not available:
        raise ValueError(f"No requested feature columns were found in the dataset. Requested: {feature_cols}")
    if missing:
        print(f"Warning: some requested features are unavailable and will be omitted: {missing}")
    return available


def build_station_sequences(
    df: pd.DataFrame,
    feature_cols: Sequence[str] | None = None,
    target_col: str = "target_PM25_1h",
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH,
    horizon: int = 1,
    station_col: str = "StationId",
) -> Dict[str, np.ndarray]:
    """Build per-station LSTM sequences while keeping each station and time order intact."""
    if sequence_length <= 0:
        raise ValueError("Sequence length must be positive.")
    if horizon <= 0:
        raise ValueError("Forecast horizon must be positive.")

    features = _select_feature_columns(df, feature_cols)
    if target_col not in df.columns:
        raise KeyError(f"Target column '{target_col}' is missing from the dataset.")

    X_list: List[np.ndarray] = []
    y_list: List[np.ndarray] = []
    timestamps_list: List[np.ndarray] = []
    station_list: List[np.ndarray] = []

    for station_id, station_df in df.groupby(station_col, sort=True):
        station_df = station_df.sort_values("Datetime").reset_index(drop=True)
        sequence_count = len(station_df) - sequence_length - horizon + 1
        if sequence_count <= 0:
            continue

        for start_idx in range(sequence_count):
            end_idx = start_idx + sequence_length - 1
            target_idx = end_idx + horizon

            if target_idx >= len(station_df):
                continue

            seq_slice = station_df.iloc[start_idx : end_idx + 1][features]
            target_value = station_df.iloc[target_idx][target_col]
            if pd.isna(target_value):
                continue
            if seq_slice.isnull().any().any():
                continue

            X_list.append(seq_slice.to_numpy(dtype=np.float32))
            y_list.append(np.array([float(target_value)], dtype=np.float32))
            timestamps_list.append(np.array([station_df.iloc[end_idx]["Datetime"], station_df.iloc[target_idx]["Datetime"]]))
            station_list.append(np.array([station_id, station_id], dtype=object))

    if len(X_list) == 0:
        raise ValueError("No valid LSTM samples were created. Check the temporal coverage and target columns.")

    return {
        "X": np.stack(X_list, axis=0),
        "y": np.concatenate(y_list, axis=0),
        "timestamps": np.array(timestamps_list, dtype=object),
        "station_ids": np.array(station_list, dtype=object),
    }


def fit_sequence_scaler(train_X: np.ndarray) -> StandardScaler:
    """Fit a scaler only on the training window features and preserve the 3D sequence shape for transforms."""
    scaler = StandardScaler()
    reshaped = train_X.reshape(-1, train_X.shape[-1])
    scaler.fit(reshaped)
    return scaler


def transform_sequence_with_scaler(scaler: StandardScaler, X: np.ndarray) -> np.ndarray:
    """Apply a fitted sequence scaler to a 3D sequence array while preserving the original shape."""
    flat = X.reshape(-1, X.shape[-1])
    transformed = scaler.transform(flat)
    return transformed.reshape(X.shape)


def fit_target_scaler(train_y: np.ndarray) -> StandardScaler:
    target_scaler = StandardScaler()
    target_scaler.fit(train_y.reshape(-1, 1))
    return target_scaler


def create_lstm_model(input_shape: Tuple[int, int], hidden_units: int = 64, dropout: float = 0.2, learning_rate: float = 0.001) -> Sequential:
    """Create a compact LSTM regressor for 24-hour sequences."""
    model = Sequential(
        [
            LSTM(hidden_units, input_shape=input_shape, return_sequences=False),
            Dropout(dropout),
            Dense(32, activation="relu"),
            Dense(1),
        ]
    )
    model.compile(optimizer=Adam(learning_rate=learning_rate), loss="mse")
    return model


def train_lstm_model(
    model: Sequential,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = 30,
    batch_size: int = 32,
    patience: int = 5,
    verbose: int = 0,
) -> Dict[str, object]:
    """Train the model with early stopping based on validation loss."""
    callbacks = [EarlyStopping(monitor="val_loss", patience=patience, restore_best_weights=True)]
    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=verbose,
    )
    return {"history": history.history, "final_epoch": len(history.history["loss"]) }


def evaluate_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float | None]:
    """Compute MAE, RMSE, R2, and MAPE where it is numerically safe."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    metrics: Dict[str, float | None] = {
        "MAE": float(mean_absolute_error(y_true, y_pred)),
        "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "R2": float(r2_score(y_true, y_pred)),
    }

    safe_actual = np.abs(y_true)
    non_zero_mask = safe_actual > 1e-6
    if non_zero_mask.any():
        abs_pct_error = np.abs((y_true[non_zero_mask] - y_pred[non_zero_mask]) / y_true[non_zero_mask]) * 100.0
        metrics["MAPE"] = float(np.mean(abs_pct_error))
    else:
        metrics["MAPE"] = None
    return metrics


def save_predictions_csv(
    predictions_df: pd.DataFrame,
    output_path: str,
) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    predictions_df.to_csv(output_path, index=False)


def save_metrics_csv(metrics_df: pd.DataFrame, output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    metrics_df.to_csv(output_path, index=False)


def _create_prediction_frame(
    timestamps: np.ndarray,
    station_ids: np.ndarray,
    actual: np.ndarray,
    predicted: np.ndarray,
    horizon: int,
) -> pd.DataFrame:
    frame = pd.DataFrame(
        {
            "timestamp": timestamps,
            "StationId": station_ids,
            "actual_PM25": actual,
            "predicted_PM25": predicted,
            "horizon": horizon,
        }
    )
    frame = frame.rename(columns={"timestamp": "Datetime"})
    return frame[["Datetime", "StationId", "actual_PM25", "predicted_PM25", "horizon"]]


def run_lstm_forecast_pipeline(
    data_path: str = "data/processed/mumbai_feature_engineered.csv",
    horizon_values: Sequence[int] = (1, 3, 6),
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH,
    feature_cols: Sequence[str] | None = None,
    validation_fraction: float = 0.15,
    test_fraction: float = 0.15,
    model_dir: str = "models",
    results_dir: str = "results",
    figures_dir: str = "reports/figures",
    epochs: int = 30,
    batch_size: int = 32,
    hidden_units: int = 64,
    dropout: float = 0.2,
    learning_rate: float = 0.001,
    verbose_training: int = 0,
) -> Dict[str, object]:
    df = load_forecasting_data(data_path)
    df = ensure_forecast_targets(df, horizons=horizon_values)
    validation = validate_forecasting_data(df)
    if not validation["required_columns_present"]:
        raise ValueError("Required forecasting columns are not present in the dataset.")

    train_df, val_df, test_df = chronological_split(df, validation_fraction, test_fraction)
    all_metrics: List[Dict[str, float | None]] = []
    prediction_frames: List[pd.DataFrame] = []
    model_outputs: Dict[str, object] = {}
    loss_history: List[Tuple[int, float, float]] = []

    feature_list = _select_feature_columns(df, feature_cols)
    os.makedirs(model_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)
    os.makedirs(figures_dir, exist_ok=True)

    for horizon in horizon_values:
        target_col = TARGET_MAP[horizon]
        train_seq = build_station_sequences(train_df, feature_list, target_col, sequence_length, horizon=horizon)
        val_seq = build_station_sequences(val_df, feature_list, target_col, sequence_length, horizon=horizon)
        test_seq = build_station_sequences(test_df, feature_list, target_col, sequence_length, horizon=horizon)

        X_train = train_seq["X"]
        y_train = train_seq["y"]
        X_val = val_seq["X"]
        y_val = val_seq["y"]
        X_test = test_seq["X"]
        y_test = test_seq["y"]

        train_scaler = fit_sequence_scaler(X_train)
        target_scaler = fit_target_scaler(y_train)
        X_train_scaled = transform_sequence_with_scaler(train_scaler, X_train)
        X_val_scaled = transform_sequence_with_scaler(train_scaler, X_val)
        X_test_scaled = transform_sequence_with_scaler(train_scaler, X_test)
        y_train_scaled = target_scaler.transform(y_train.reshape(-1, 1)).ravel()
        y_val_scaled = target_scaler.transform(y_val.reshape(-1, 1)).ravel()

        model = create_lstm_model((sequence_length, len(feature_list)), hidden_units=hidden_units, dropout=dropout, learning_rate=learning_rate)
        training_info = train_lstm_model(model, X_train_scaled, y_train_scaled, X_val_scaled, y_val_scaled, epochs=epochs, batch_size=batch_size, verbose=verbose_training)
        for epoch, loss_val in enumerate(training_info["history"]["loss"], 1):
            val_loss = training_info["history"].get("val_loss", [np.nan] * len(training_info["history"]["loss"]))[epoch - 1]
            loss_history.append((horizon, epoch, float(loss_val)))

        y_pred_scaled = model.predict(X_test_scaled, verbose=0).ravel()
        y_pred = target_scaler.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
        metrics = evaluate_regression_metrics(y_test, y_pred)
        all_metrics.append({"horizon": horizon, **metrics})

        prediction_frame = _create_prediction_frame(
            timestamps=test_seq["timestamps"][:, 1],
            station_ids=test_seq["station_ids"][:, 0],
            actual=y_test,
            predicted=y_pred,
            horizon=horizon,
        )
        prediction_frames.append(prediction_frame)

        model_path = os.path.join(model_dir, f"lstm_{horizon}h.keras")
        model.save(model_path)
        model_outputs[f"lstm_{horizon}h"] = model_path

        out_csv = os.path.join(results_dir, f"lstm_{horizon}h_predictions.csv")
        save_predictions_csv(prediction_frame, out_csv)

        fig, ax = plt.subplots(figsize=(14, 6))
        sample_limit = min(len(prediction_frame), 500)
        x_index = np.arange(sample_limit)
        ax.plot(x_index, prediction_frame["actual_PM25"].iloc[:sample_limit].to_numpy(), label="Actual PM2.5", color="black", linewidth=1.8)
        ax.plot(x_index, prediction_frame["predicted_PM25"].iloc[:sample_limit].to_numpy(), label=f"{horizon}-hour forecast", linestyle="--", color="C0", linewidth=1.5)
        ax.set_title(f"Actual vs Predicted PM2.5 ({horizon}-hour LSTM)")
        ax.set_xlabel("Test observation index")
        ax.set_ylabel("PM2.5 (µg/m³)")
        ax.legend()
        fig.tight_layout()
        fig.savefig(os.path.join(figures_dir, f"lstm_{horizon}h_actual_vs_predicted.png"), dpi=300)
        plt.close(fig)

    metrics_df = pd.DataFrame(all_metrics)
    save_metrics_csv(metrics_df, os.path.join(results_dir, "lstm_metrics.csv"))

    loss_df = pd.DataFrame(loss_history, columns=["horizon", "epoch", "val_loss"])
    for horizon in horizon_values:
        horizon_loss = loss_df[loss_df["horizon"] == horizon]
        if horizon_loss.empty:
            continue
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(horizon_loss["epoch"], horizon_loss["val_loss"], marker="o")
        ax.set_title(f"LSTM Validation Loss ({horizon}-hour forecast)")
        ax.set_xlabel("Epoch")
        ax.set_ylabel("Validation loss (MSE)")
        fig.tight_layout()
        fig.savefig(os.path.join(figures_dir, f"lstm_{horizon}h_training_loss.png"), dpi=300)
        plt.close(fig)

    return {
        "train_rows": len(train_df),
        "val_rows": len(val_df),
        "test_rows": len(test_df),
        "features": feature_list,
        "sequence_length": sequence_length,
        "horizons": list(horizon_values),
        "metrics": metrics_df,
        "model_paths": model_outputs,
        "validation_report": validation,
    }


if __name__ == "__main__":
    results = run_lstm_forecast_pipeline()
    print(results)
