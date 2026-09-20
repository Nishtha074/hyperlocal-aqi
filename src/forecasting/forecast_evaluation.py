from __future__ import annotations

import os
from typing import Dict, Iterable, List

import matplotlib.pyplot as plt
import pandas as pd


SEQUENCE_NOTE = (
    "LSTM uses a 24-hour sequence window; only sequence-aligned test rows with complete history are "
    "evaluated, so the LSTM comparison is constrained by the windowed train/validation/test split and "
    "may not match the full XGBoost test set one-for-one."
)


def _normalize_xgboost_metrics(xgb_df: pd.DataFrame) -> pd.DataFrame:
    if xgb_df.empty:
        raise ValueError("XGBoost metrics table is empty.")
    cols = {"Model": "Model", "MAE": "MAE", "RMSE": "RMSE", "R2": "R2"}
    normalized = xgb_df.rename(columns={k: v for k, v in cols.items() if k in xgb_df.columns}).copy()
    normalized["horizon"] = 1
    normalized["Model"] = normalized["Model"].fillna("XGBoost")
    normalized["sequence_window_note"] = SEQUENCE_NOTE
    return normalized[["Model", "horizon", "MAE", "RMSE", "R2", "sequence_window_note"]]


def _normalize_lstm_metrics(lstm_df: pd.DataFrame) -> pd.DataFrame:
    if lstm_df.empty:
        raise ValueError("LSTM metrics table is empty.")
    normalized = lstm_df.copy()
    if "horizon" not in normalized.columns:
        raise KeyError("LSTM metrics must include a 'horizon' column.")
    normalized["Model"] = "LSTM"
    normalized["sequence_window_note"] = SEQUENCE_NOTE
    column_order = ["Model", "horizon", "MAE", "RMSE", "R2", "MAPE", "sequence_window_note"]
    normalized = normalized[[col for col in column_order if col in normalized.columns]]
    return normalized


def build_comparison_table(xgb_df: pd.DataFrame, lstm_df: pd.DataFrame) -> pd.DataFrame:
    """Combine baseline XGBoost and LSTM results into a single fair comparison table."""
    xgb_table = _normalize_xgboost_metrics(xgb_df)
    lstm_table = _normalize_lstm_metrics(lstm_df)

    comparison = pd.concat([xgb_table, lstm_table], ignore_index=True)
    comparison["horizon"] = pd.to_numeric(comparison["horizon"], errors="coerce").astype("Int64")
    comparison["MAE"] = pd.to_numeric(comparison["MAE"], errors="coerce")
    comparison["RMSE"] = pd.to_numeric(comparison["RMSE"], errors="coerce")
    comparison["R2"] = pd.to_numeric(comparison["R2"], errors="coerce")
    if "MAPE" in comparison.columns:
        comparison["MAPE"] = pd.to_numeric(comparison["MAPE"], errors="coerce")
    comparison = comparison.sort_values(["Model", "horizon"], kind="mergesort").reset_index(drop=True)
    return comparison


def save_comparison_outputs(
    xgb_metrics_path: str = "results/model_comparison.csv",
    lstm_metrics_path: str = "results/lstm_metrics.csv",
    output_path: str = "results/week12_model_comparison.csv",
    report_path: str = "reports/week12_forecast_evaluation.md",
    figures_dir: str = "reports/figures",
) -> pd.DataFrame:
    xgb_df = pd.read_csv(xgb_metrics_path)
    lstm_df = pd.read_csv(lstm_metrics_path)
    comparison = build_comparison_table(xgb_df, lstm_df)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    os.makedirs(os.path.dirname(report_path) or ".", exist_ok=True)
    os.makedirs(figures_dir, exist_ok=True)
    comparison.to_csv(output_path, index=False)

    xgb_row = comparison[comparison["Model"] == "XGBoost"].iloc[0]
    lstm_rows = comparison[comparison["Model"] == "LSTM"]
    best_horizon = lstm_rows.loc[lstm_rows["MAE"].idxmin(), "horizon"]
    best_mae = lstm_rows["MAE"].min()
    xgb_mae = xgb_row["MAE"]
    summary = f"# Week 12 Forecast Evaluation\n\n"
    summary += "## Comparison method\n"
    summary += "- XGBoost baseline uses the official 1-hour target from the Week 10 engineered dataset.\n"
    summary += "- LSTM is evaluated on the 24-hour sequence-aligned test rows for each horizon.\n"
    summary += "- The notebook and script document that LSTM evaluation is limited by complete historical context, so sequence-aligned rows may not match the XGBoost test set perfectly.\n\n"
    summary += "## Summary metrics\n"
    summary += f"- XGBoost MAE (1h): {xgb_mae:.4f}\n"
    summary += f"- Best LSTM MAE: {best_mae:.4f} at horizon {best_horizon}h\n"
    summary += f"- Sequence note: {SEQUENCE_NOTE}\n"

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(summary)

    fig, ax = plt.subplots(figsize=(10, 6))
    labels = []
    values = []
    colors = []
    for _, row in comparison.iterrows():
        labels.append(f"{row['Model']} {int(row['horizon'])}h")
        values.append(float(row["MAE"]))
        colors.append("#1f77b4" if row["Model"] == "LSTM" else "#ff7f0e")
    bar_positions = list(range(len(values)))
    ax.bar(bar_positions, values, color=colors)
    ax.set_xticks(bar_positions)
    ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_title("MAE by model and forecast horizon")
    ax.set_ylabel("MAE (µg/m³)")
    fig.tight_layout()
    fig.savefig(os.path.join(figures_dir, "week12_mae_comparison.png"), dpi=300)
    plt.close(fig)

    return comparison
