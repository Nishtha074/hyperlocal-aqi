import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.forecasting.forecast_evaluation import save_comparison_outputs


if __name__ == "__main__":
    print("=" * 80)
    print("WEEK 12: FORECAST EVALUATION")
    print("=" * 80)
    comparison = save_comparison_outputs(
        xgb_metrics_path="results/model_comparison.csv",
        lstm_metrics_path="results/lstm_metrics.csv",
        output_path="results/week12_model_comparison.csv",
        report_path="reports/week12_forecast_evaluation.md",
        figures_dir="reports/figures",
    )
    print(comparison.to_string(index=False))
    print("\nSaved comparison CSV to results/week12_model_comparison.csv")
    print("Saved evaluation summary to reports/week12_forecast_evaluation.md")
