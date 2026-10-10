"""Chronological, measured-target backtest for horizon-specific XGBoost models.

The script fits evaluation-only models in memory. It never writes or modifies a
production model. Labels are joined to measured PM2.5 at the exact future time;
precomputed, forward-filled target columns are deliberately ignored.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FEATURES = PROJECT_ROOT / "data/processed/mumbai_feature_engineered.csv"
DEFAULT_OBSERVATIONS = PROJECT_ROOT / "data/processed/master_pollution_weather.csv"
DEFAULT_MODEL = PROJECT_ROOT / "models/xgboost_gujarat_maharashtra.pkl"
DEFAULT_OUTPUT = PROJECT_ROOT / "results/xgboost_historical_backtest.csv"
KEY_COLUMNS = ["StationId", "Datetime"]
HORIZONS = (1, 3, 6)


def _validate_unique_keys(frame: pd.DataFrame, name: str) -> None:
    duplicates = frame.duplicated(KEY_COLUMNS)
    if duplicates.any():
        raise ValueError(f"{name} contains duplicate StationId/Datetime rows.")


def load_measured_observations(path: Path) -> pd.DataFrame:
    """Load only real PM2.5 measurements, retaining their original timestamps."""
    observations = pd.read_csv(path, usecols=KEY_COLUMNS + ["PM2.5"])
    observations["Datetime"] = pd.to_datetime(observations["Datetime"], errors="coerce")
    observations["PM2.5"] = pd.to_numeric(observations["PM2.5"], errors="coerce")
    if observations["Datetime"].isna().any() and observations["PM2.5"].notna().any():
        invalid = observations["Datetime"].isna() & observations["PM2.5"].notna()
        if invalid.any():
            raise ValueError("Measured PM2.5 rows contain invalid timestamps.")
    _validate_unique_keys(observations, str(path))
    return observations.dropna(subset=["Datetime", "PM2.5"]).sort_values(KEY_COLUMNS)


def attach_actual_targets(
    feature_rows: pd.DataFrame,
    measured_observations: pd.DataFrame,
    horizon_hours: int,
) -> pd.DataFrame:
    """Attach measured origin/future PM2.5 values using exact elapsed hours."""
    if horizon_hours not in HORIZONS:
        raise ValueError(f"Unsupported horizon: {horizon_hours}")

    features = feature_rows.copy()
    features["Datetime"] = pd.to_datetime(features["Datetime"], errors="coerce")
    if features["Datetime"].isna().any():
        raise ValueError("Feature rows contain invalid timestamps.")
    _validate_unique_keys(features, "Feature data")

    measured = measured_observations[KEY_COLUMNS + ["PM2.5"]].copy()
    _validate_unique_keys(measured, "Measured observations")
    measured = measured.dropna(subset=["PM2.5", "Datetime"])

    origins = measured.rename(columns={"PM2.5": "_origin_pm25"})
    future = measured.rename(
        columns={"Datetime": "target_datetime", "PM2.5": "actual_pm25"}
    )
    future["Datetime"] = future["target_datetime"] - pd.Timedelta(hours=horizon_hours)

    joined = features.merge(origins, on=KEY_COLUMNS, how="inner", validate="one_to_one")
    return joined.merge(
        future[KEY_COLUMNS + ["target_datetime", "actual_pm25"]],
        on=KEY_COLUMNS,
        how="inner",
        validate="one_to_one",
    )


def split_chronologically(
    rows: pd.DataFrame, test_start: pd.Timestamp
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split by origin time and purge training labels reaching the test period."""
    train = rows.loc[
        (rows["Datetime"] < test_start) & (rows["target_datetime"] < test_start)
    ].copy()
    test = rows.loc[rows["Datetime"] >= test_start].copy()
    return train, test


def _feature_frame(path: Path, model: XGBRegressor) -> tuple[pd.DataFrame, list[str]]:
    raw = pd.read_csv(path)
    required = set(KEY_COLUMNS)
    missing_keys = required.difference(raw.columns)
    if missing_keys:
        raise ValueError(f"Feature data is missing key columns: {sorted(missing_keys)}")
    raw["Datetime"] = pd.to_datetime(raw["Datetime"], errors="coerce")
    if raw["Datetime"].isna().any():
        raise ValueError("Feature data contains invalid timestamps.")

    encoded = pd.get_dummies(raw, columns=["StationId"], dtype=int)
    encoded["StationId"] = raw["StationId"].to_numpy()
    feature_names = list(model.feature_names_in_)
    missing = [name for name in feature_names if name not in encoded.columns]
    non_station_missing = [name for name in missing if not name.startswith("StationId_")]
    if non_station_missing:
        raise ValueError(f"Feature data is missing model features: {non_station_missing}")
    for name in missing:
        encoded[name] = 0

    _validate_unique_keys(encoded, str(path))
    return encoded[KEY_COLUMNS + feature_names], feature_names


def _evaluation_cutoff(feature_rows: pd.DataFrame, train_ratio: float) -> pd.Timestamp:
    timestamps = pd.Series(feature_rows["Datetime"].dropna().unique()).sort_values().reset_index(drop=True)
    split_index = int(len(timestamps) * train_ratio)
    if split_index <= 0 or split_index >= len(timestamps):
        raise ValueError("The chronological split leaves an empty train or test period.")
    return pd.Timestamp(timestamps.iloc[split_index])


def run_backtest(
    feature_path: Path = DEFAULT_FEATURES,
    observations_path: Path = DEFAULT_OBSERVATIONS,
    model_path: Path = DEFAULT_MODEL,
    output_path: Path | None = DEFAULT_OUTPUT,
    train_ratio: float = 0.8,
) -> pd.DataFrame:
    """Fit three in-memory XGBoost models and score exact measured targets."""
    if not 0.5 <= train_ratio < 1.0:
        raise ValueError("train_ratio must be at least 0.5 and less than 1.0.")

    production_model = joblib.load(model_path)
    if not isinstance(production_model, XGBRegressor):
        raise TypeError(f"Expected XGBRegressor at {model_path}.")

    feature_rows, feature_names = _feature_frame(feature_path, production_model)
    measured = load_measured_observations(observations_path)
    origins = feature_rows.merge(
        measured[KEY_COLUMNS], on=KEY_COLUMNS, how="inner", validate="one_to_one"
    )
    test_start = _evaluation_cutoff(origins, train_ratio)
    params = production_model.get_params(deep=False)
    results = []

    for horizon in HORIZONS:
        rows = attach_actual_targets(feature_rows, measured, horizon)
        rows = rows.dropna(subset=feature_names + ["actual_pm25"])
        train, test = split_chronologically(rows, test_start)
        if train.empty or test.empty:
            raise ValueError(f"Insufficient train or test samples for the {horizon}h horizon.")

        evaluation_model = XGBRegressor(**params)
        evaluation_model.fit(train[feature_names], train["actual_pm25"])
        predictions = evaluation_model.predict(test[feature_names])
        results.append(
            {
                "horizon_hours": horizon,
                "mae": float(mean_absolute_error(test["actual_pm25"], predictions)),
                "rmse": float(np.sqrt(mean_squared_error(test["actual_pm25"], predictions))),
                "valid_test_samples": int(len(test)),
                "test_stations": int(test["StationId"].nunique()),
                "test_start": test_start,
            }
        )

    result_frame = pd.DataFrame(results)
    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result_frame.to_csv(output_path, index=False)

    print(f"Historical measured-PM2.5 backtest; chronological test starts {test_start}")
    print("Evaluation-only horizon-specific XGBoost fits; production model was not modified.")
    print(result_frame.to_string(index=False, formatters={"mae": "{:.3f}".format, "rmse": "{:.3f}".format}))
    if output_path is not None:
        print(f"Saved metrics to {output_path}")
    return result_frame


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--features", type=Path, default=DEFAULT_FEATURES)
    parser.add_argument("--observations", type=Path, default=DEFAULT_OBSERVATIONS)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--train-ratio", type=float, default=0.8)
    args = parser.parse_args(argv)
    run_backtest(args.features, args.observations, args.model, args.output, args.train_ratio)


if __name__ == "__main__":
    main()