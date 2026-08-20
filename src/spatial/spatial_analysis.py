import math
import os
from typing import Optional

import pandas as pd


WEEK5_PATH = os.path.join("notebooks", "mumbai_forecasting_ready.csv")
METADATA_PATH = os.path.join("data", "external", "mumbai_station_metadata.csv")
PROCESSED_DIR = os.path.join("data", "processed")
FIGURES_DIR = os.path.join("reports", "figures")
COORDINATE_COLUMNS = {"latitude", "longitude"}


class MissingSpatialMetadataError(ValueError):
    """Raised when verified station coordinates are not available."""


def load_week5_output(path: str = WEEK5_PATH) -> pd.DataFrame:
    return pd.read_csv(path)


def validate_coordinates(metadata: pd.DataFrame) -> pd.DataFrame:
    required = {"StationId", "Latitude", "Longitude"}
    missing = required.difference(metadata.columns)
    if missing:
        raise MissingSpatialMetadataError(
            "Verified station metadata must contain: " + ", ".join(sorted(required))
        )

    result = metadata.copy()
    result["Latitude"] = pd.to_numeric(result["Latitude"], errors="coerce")
    result["Longitude"] = pd.to_numeric(result["Longitude"], errors="coerce")
    invalid = (
        result["Latitude"].isna()
        | result["Longitude"].isna()
        | ~result["Latitude"].between(-90, 90)
        | ~result["Longitude"].between(-180, 180)
    )
    if invalid.any():
        raise MissingSpatialMetadataError(
            f"Station metadata contains {int(invalid.sum())} missing or invalid coordinate rows."
        )
    if result["StationId"].duplicated().any():
        raise MissingSpatialMetadataError("Station metadata contains duplicate StationId values.")
    return result


def station_pollution_summary(
    week5: pd.DataFrame, metadata: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    required = {"StationId", "PM2.5"}
    missing = required.difference(week5.columns)
    if missing:
        raise ValueError(f"Week 5 data is missing required columns: {sorted(missing)}")

    values = week5.assign(PM2_5_numeric=pd.to_numeric(week5["PM2.5"], errors="coerce"))
    summary = (
        values.groupby("StationId", as_index=False)
        .agg(
            observation_count=("PM2_5_numeric", "count"),
            mean_pm25=("PM2_5_numeric", "mean"),
            median_pm25=("PM2_5_numeric", "median"),
            max_pm25=("PM2_5_numeric", "max"),
            min_pm25=("PM2_5_numeric", "min"),
        )
    )
    if metadata is not None:
        metadata = validate_coordinates(metadata)
        summary = metadata.merge(summary, on="StationId", how="left", validate="one_to_one")
    return summary


def haversine_km(latitude_a, longitude_a, latitude_b, longitude_b) -> float:
    radius_km = 6371.0088
    lat_a, lat_b = math.radians(latitude_a), math.radians(latitude_b)
    delta_lat = math.radians(latitude_b - latitude_a)
    delta_lon = math.radians(longitude_b - longitude_a)
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(value))


def pairwise_distances(metadata: pd.DataFrame) -> pd.DataFrame:
    metadata = validate_coordinates(metadata)
    rows = []
    for position, (_, left) in enumerate(metadata.iterrows()):
        for _, right in metadata.iloc[position + 1 :].iterrows():
            rows.append(
                {
                    "station_a": left["StationId"],
                    "station_b": right["StationId"],
                    "distance_km": haversine_km(
                        left["Latitude"], left["Longitude"], right["Latitude"], right["Longitude"]
                    ),
                }
            )
    return pd.DataFrame(rows, columns=["station_a", "station_b", "distance_km"])


def nearest_station_summary(metadata: pd.DataFrame) -> pd.DataFrame:
    metadata = validate_coordinates(metadata)
    rows = []
    for index, station in metadata.iterrows():
        distances = []
        for _, candidate in metadata.drop(index).iterrows():
            distances.append(
                (candidate["StationId"], haversine_km(station["Latitude"], station["Longitude"], candidate["Latitude"], candidate["Longitude"]))
            )
        nearest_id, nearest_distance = min(distances, key=lambda item: item[1])
        rows.append(
            {
                "station_id": station["StationId"],
                "nearest_station_id": nearest_id,
                "nearest_station_distance_km": nearest_distance,
            }
        )
    return pd.DataFrame(rows)


def nearby_station_counts(metadata: pd.DataFrame, radius_km: float = 5.0) -> pd.DataFrame:
    if radius_km < 0:
        raise ValueError("radius_km must be non-negative")
    metadata = validate_coordinates(metadata)
    rows = []
    for position, (_, station) in enumerate(metadata.iterrows()):
        count = 0
        for _, candidate in metadata.drop(metadata.index[position]).iterrows():
            distance = haversine_km(station["Latitude"], station["Longitude"], candidate["Latitude"], candidate["Longitude"])
            count += distance <= radius_km
        rows.append({"station_id": station["StationId"], "nearby_station_count": count, "radius_km": radius_km})
    return pd.DataFrame(rows)


def require_station_metadata(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise MissingSpatialMetadataError(
            f"Coordinates unavailable from current project source. Missing verified metadata file: {path}"
        )
    return validate_coordinates(pd.read_csv(path))


def match_station_metadata(week5: pd.DataFrame, metadata: pd.DataFrame) -> pd.DataFrame:
    metadata = validate_coordinates(metadata)
    week5_ids = set(week5["StationId"].dropna().unique())
    metadata_ids = set(metadata["StationId"])
    missing = week5_ids - metadata_ids
    if missing:
        raise MissingSpatialMetadataError(f"Week 5 station IDs missing from metadata: {sorted(missing)}")
    return metadata[metadata["StationId"].isin(week5_ids)].copy()


def _write_map(data: pd.DataFrame, path: str, color_column: Optional[str] = None, title: str = "Monitoring stations") -> None:
    import plotly.graph_objects as go

    os.makedirs(os.path.dirname(path), exist_ok=True)
    marker = {"size": 12, "color": data[color_column] if color_column else "#1565c0", "colorscale": "YlOrRd", "showscale": bool(color_column)}
    figure = go.Figure(go.Scattergeo(
        lat=data["Latitude"], lon=data["Longitude"], text=data["StationId"], customdata=data.get("StationName"),
        mode="markers+text", textposition="top center", marker=marker, hovertemplate="%{text}<br>%{customdata}<extra></extra>"
    ))
    figure.update_geos(scope="asia", showcountries=True, showland=True, landcolor="#eef3f5", center={"lat": 19.05, "lon": 72.87}, projection_scale=8)
    figure.update_layout(title=title, margin={"l": 0, "r": 0, "t": 45, "b": 0})
    figure.write_html(path, include_plotlyjs="cdn")


def run_week6_pipeline(week5_path: str = WEEK5_PATH, metadata_path: str = METADATA_PATH, radius_km: float = 5.0) -> dict:
    week5 = load_week5_output(week5_path)
    metadata = require_station_metadata(metadata_path)
    metadata = match_station_metadata(week5, metadata)
    summary = station_pollution_summary(week5, metadata)
    distances = pairwise_distances(metadata).rename(columns={"station_a": "StationId_1", "station_b": "StationId_2"})
    nearest = nearest_station_summary(metadata)
    nearby = nearby_station_counts(metadata, radius_km).rename(columns={"station_id": "StationId", "radius_km": "nearby_station_radius_km"})
    features = summary.merge(nearby, on="StationId", validate="one_to_one").merge(nearest, left_on="StationId", right_on="station_id", validate="one_to_one").drop(columns=["station_id"])
    features = features.rename(columns={"mean_pm25": "mean_PM25", "median_pm25": "median_PM25", "min_pm25": "min_PM25", "max_pm25": "max_PM25", "observation_count": "observation_count"})

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(FIGURES_DIR, exist_ok=True)
    summary.to_csv(os.path.join(PROCESSED_DIR, "station_spatial_summary.csv"), index=False)
    distances.to_csv(os.path.join(PROCESSED_DIR, "station_distances.csv"), index=False)
    features.to_csv(os.path.join(PROCESSED_DIR, "spatial_station_features.csv"), index=False)
    _write_map(metadata, os.path.join(FIGURES_DIR, "station_map.html"), title="Mumbai monitoring stations")
    _write_map(summary, os.path.join(FIGURES_DIR, "pm25_station_pollution_map.html"), color_column="mean_pm25", title="Mean PM2.5 by monitoring station")

    quality = pd.DataFrame([{
        "total_stations": len(metadata), "valid_coordinate_stations": len(metadata), "missing_coordinate_stations": 0,
        "unmatched_station_metadata": 0, "duplicate_conflicting_metadata": 0, "pairwise_distance_count": len(distances),
        "minimum_distance_km": distances["distance_km"].min(), "maximum_distance_km": distances["distance_km"].max(),
        "mean_distance_km": distances["distance_km"].mean(), "median_distance_km": distances["distance_km"].median(),
        "nearby_station_radius_km": radius_km, "minimum_nearby_count": nearby["nearby_station_count"].min(),
        "maximum_nearby_count": nearby["nearby_station_count"].max(), "average_nearby_count": nearby["nearby_station_count"].mean(),
        "road_distance_coverage": "BLOCKED: no legitimate road geometry found"
    }])
    quality.to_csv(os.path.join(PROCESSED_DIR, "spatial_quality_report.csv"), index=False)
    return {"summary": summary, "distances": distances, "features": features, "nearby": nearby, "quality": quality}


if __name__ == "__main__":
    result = run_week6_pipeline()
    print(result["features"].to_string(index=False))
    print("Week 6 geographic pipeline complete; distance-to-roads blocked: no road geometry found.")
