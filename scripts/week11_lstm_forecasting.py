import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.forecasting.lstm_forecasting import run_lstm_forecast_pipeline


if __name__ == "__main__":
    print("=" * 80)
    print("WEEK 11: LSTM FORECASTING PIPELINE")
    print("=" * 80)
    results = run_lstm_forecast_pipeline(
        data_path="data/processed/mumbai_feature_engineered.csv",
        horizon_values=(1, 3, 6),
        sequence_length=24,
        validation_fraction=0.15,
        test_fraction=0.15,
        model_dir="models",
        results_dir="results",
        figures_dir="reports/figures",
        epochs=30,
        batch_size=32,
        hidden_units=64,
        dropout=0.2,
        learning_rate=0.001,
        verbose_training=0,
    )
    print("Train rows:", results["train_rows"])
    print("Validation rows:", results["val_rows"])
    print("Test rows:", results["test_rows"])
    print("Selected features:", results["features"])
    print(results["metrics"].to_string(index=False))
    print("Saved models:", results["model_paths"])
