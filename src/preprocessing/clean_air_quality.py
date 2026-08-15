import os
import pandas as pd
from typing import Tuple, Dict


DEFAULT_RAW_PATH = os.path.join("data", "processed", "mumbai_pm25_raw.csv")
DEFAULT_CLEAN_PATH = os.path.join("data", "processed", "clean_air_quality.csv")
DEFAULT_REPORT_PATH = os.path.join("data", "processed", "data_quality_report.csv")


def load_raw_air_quality(path: str = None) -> pd.DataFrame:
    path = path or DEFAULT_RAW_PATH
    df = pd.read_csv(path)
    return df


def inspect_data(df: pd.DataFrame) -> Dict:
    info = {}
    info["shape"] = df.shape
    info["columns"] = df.columns.tolist()
    info["head"] = df.head(5)
    info["tail"] = df.tail(5)
    info["dtypes"] = df.dtypes.apply(lambda x: str(x)).to_dict()
    info["missing"] = df.isna().sum().to_dict()
    if "StationId" in df.columns:
        info["unique_stations"] = int(df["StationId"].nunique())
        info["station_names"] = df["StationId"].unique().tolist()
    else:
        info["unique_stations"] = 0
        info["station_names"] = []
    # timestamp range if present
    if "Datetime" in df.columns:
        try:
            ts = pd.to_datetime(df["Datetime"], errors="coerce")
            info["timestamp_min"] = ts.min()
            info["timestamp_max"] = ts.max()
        except Exception:
            info["timestamp_min"] = None
            info["timestamp_max"] = None
    return info


def clean_timestamps(df: pd.DataFrame, ts_col: str = "Datetime") -> Tuple[pd.DataFrame, Dict]:
    report = {}
    before = len(df)
    if ts_col not in df.columns:
        report["rows_before"] = before
        report["invalid_timestamps"] = 0
        report["rows_removed"] = 0
        report["rows_after"] = before
        return df, report

    df[ts_col] = pd.to_datetime(df[ts_col], errors="coerce")
    invalid_ts = df[ts_col].isna().sum()
    # remove rows without a valid timestamp since they can't be used
    df = df[df[ts_col].notna()].copy()
    df = df.sort_values(["StationId", ts_col]) if "StationId" in df.columns else df.sort_values(ts_col)
    report["rows_before"] = before
    report["invalid_timestamps"] = int(invalid_ts)
    report["rows_removed"] = int(before - len(df))
    report["rows_after"] = len(df)
    return df, report


def remove_duplicates(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
    report = {}
    before = len(df)
    exact_dup = df.duplicated(keep="first").sum()
    df = df.drop_duplicates(keep="first").copy()

    # logical duplicates: StationId + Datetime
    logical_dup = 0
    if "StationId" in df.columns and "Datetime" in df.columns:
        # count duplicates on station+timestamp
        dup_mask = df.duplicated(subset=["StationId", "Datetime"], keep="first")
        logical_dup = int(dup_mask.sum())
        if logical_dup > 0:
            df = df[~dup_mask].copy()

    report["rows_before"] = before
    report["exact_duplicates"] = int(exact_dup)
    report["logical_duplicates"] = int(logical_dup)
    report["rows_after"] = len(df)
    report["rows_removed"] = int(before - len(df))
    return df, report


def missing_value_report(df: pd.DataFrame) -> pd.DataFrame:
    counts = df.isna().sum()
    pct = df.isna().mean() * 100
    report = pd.DataFrame({"missing_count": counts, "missing_pct": pct})
    return report


def validate_pollutant_values(df: pd.DataFrame, pollutant_cols=None) -> Dict:
    if pollutant_cols is None:
        possible = [c for c in df.columns if c.upper().startswith("PM") or c.upper() in {"NO2","SO2","CO","O3","NO","NOX","NH3"}]
        pollutant_cols = [c for c in possible if c in df.columns]

    report = {"checked_pollutants": pollutant_cols, "negative_values": {}, "non_numeric": {}}
    for col in pollutant_cols:
        # coerce to numeric
        before_nonnull = df[col].notna().sum()
        df[col] = pd.to_numeric(df[col], errors="coerce")
        non_numeric = int(df[col].isna().sum() - (len(df) - before_nonnull))
        neg_count = int((df[col] < 0).sum())
        # replace negative values with NaN (invalid)
        df.loc[df[col] < 0, col] = pd.NA
        report["negative_values"][col] = int(neg_count)
        report["non_numeric"][col] = int(non_numeric)

    return df, report


def validate_coordinates(df: pd.DataFrame) -> Dict:
    report = {"has_lat_lon": False, "invalid_lat": 0, "invalid_lon": 0, "missing_lat": 0, "missing_lon": 0}
    lat_cols = [c for c in df.columns if c.lower() in {"lat","latitude"}]
    lon_cols = [c for c in df.columns if c.lower() in {"lon","longitude","lng"}]
    if lat_cols and lon_cols:
        report["has_lat_lon"] = True
        lat = lat_cols[0]
        lon = lon_cols[0]
        df[lat] = pd.to_numeric(df[lat], errors="coerce")
        df[lon] = pd.to_numeric(df[lon], errors="coerce")
        report["missing_lat"] = int(df[lat].isna().sum())
        report["missing_lon"] = int(df[lon].isna().sum())
        report["invalid_lat"] = int(((df[lat] < -90) | (df[lat] > 90)).sum())
        report["invalid_lon"] = int(((df[lon] < -180) | (df[lon] > 180)).sum())
    return report


def check_station_consistency(df: pd.DataFrame) -> Dict:
    report = {}
    if "StationId" not in df.columns:
        report["stations_before"] = 0
        report["stations_after"] = 0
        report["station_counts"] = {}
        return report

    station_counts = df["StationId"].value_counts().to_dict()
    report["stations_before"] = len(station_counts)
    report["station_counts"] = station_counts
    # no merges or renames here — only report
    report["stations_after"] = len(station_counts)
    return report


def clean_air_quality_data(raw_path: str = None, save_clean: bool = True, save_report: bool = True) -> Dict:
    df = load_raw_air_quality(raw_path)

    qc = {}
    qc["raw_rows"] = len(df)

    # initial inspect
    qc["initial_inspect"] = inspect_data(df)

    # timestamps
    df, ts_report = clean_timestamps(df)
    qc["timestamp_cleaning"] = ts_report

    # duplicates
    df, dup_report = remove_duplicates(df)
    qc["duplicates"] = dup_report

    # missing values report (before pollutant coercion)
    qc["missing_values_before"] = missing_value_report(df).to_dict()

    # pollutant validation
    df, pollutant_report = validate_pollutant_values(df)
    qc["pollutant_validation"] = pollutant_report

    # missing values after numeric coercion
    qc["missing_values_after"] = missing_value_report(df).to_dict()

    # coordinates
    qc["coordinates"] = validate_coordinates(df)

    # station consistency
    qc["stations"] = check_station_consistency(df)

    qc["final_rows"] = len(df)

    # Save outputs
    if save_clean:
        os.makedirs(os.path.dirname(DEFAULT_CLEAN_PATH), exist_ok=True)
        df.to_csv(DEFAULT_CLEAN_PATH, index=False)
    if save_report:
        # compose a small summary report
        rep = {
            "raw_row_count": qc["raw_rows"],
            "final_row_count": qc["final_rows"],
            "rows_removed": qc["raw_rows"] - qc["final_rows"],
            "exact_duplicates": qc["duplicates"].get("exact_duplicates", 0),
            "logical_duplicates": qc["duplicates"].get("logical_duplicates", 0),
            "invalid_timestamps": qc["timestamp_cleaning"].get("invalid_timestamps", 0),
        }
        # add missing counts
        mv_before = pd.DataFrame(qc["missing_values_before"]).T
        mv_after = pd.DataFrame(qc["missing_values_after"]).T
        rep_df = pd.DataFrame([rep])
        os.makedirs(os.path.dirname(DEFAULT_REPORT_PATH), exist_ok=True)
        mv_before.to_csv(os.path.join(os.path.dirname(DEFAULT_REPORT_PATH), "missing_values_before.csv"))
        mv_after.to_csv(os.path.join(os.path.dirname(DEFAULT_REPORT_PATH), "missing_values_after.csv"))
        rep_df.to_csv(DEFAULT_REPORT_PATH, index=False)

    return {"cleaned_df": df, "qc": qc}


if __name__ == "__main__":
    out = clean_air_quality_data()
    print("Week 3 cleaning complete")
    print("Raw rows:", out["qc"]["raw_rows"])
    print("Final rows:", out["qc"]["final_rows"])
