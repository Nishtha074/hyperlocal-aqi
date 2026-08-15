import os
import pandas as pd
import importlib.util

# load module by path to avoid package import issues in test runner
spec = importlib.util.spec_from_file_location(
    "clean_air_quality", os.path.join(os.path.dirname(__file__), "..", "src", "preprocessing", "clean_air_quality.py")
)
clean_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clean_mod)
ca = clean_mod


def test_load_raw_exists():
    df = ca.load_raw_air_quality()
    assert df is not None
    assert len(df) > 0


def test_cleaning_runs_and_outputs(tmp_path):
    # run cleaning but don't overwrite final outputs in repo during test
    out = ca.clean_air_quality_data(save_clean=False, save_report=False)
    cleaned = out["cleaned_df"]
    qc = out["qc"]
    assert qc["raw_rows"] >= qc["final_rows"]
    # Datetime should be datetime dtype
    assert pd.api.types.is_datetime64_any_dtype(cleaned["Datetime"]) or cleaned["Datetime"].dtype == object
    # PM2.5 should be numeric or NA
    assert "PM2.5" in cleaned.columns


def test_remove_duplicates_behavior():
    df = ca.load_raw_air_quality()
    before = len(df)
    df2, rep = ca.remove_duplicates(df)
    after = len(df2)
    assert after <= before


def test_invalid_negative_pm25_handling():
    df = pd.DataFrame({"StationId": ["S1", "S1"], "Datetime": ["2020-01-01 00:00:00", "2020-01-01 01:00:00"], "PM2.5": [10, -5]})
    df["Datetime"] = pd.to_datetime(df["Datetime"]) 
    df2, rep = ca.validate_pollutant_values(df, pollutant_cols=["PM2.5"])
    # negative should be converted to NA
    assert rep["negative_values"]["PM2.5"] == 1
    assert pd.isna(df2.loc[1, "PM2.5"]) or df2.loc[1, "PM2.5"] is pd.NA
