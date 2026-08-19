import importlib.util
from pathlib import Path

import pandas as pd
import pytest


MODULE_PATH = Path(__file__).parents[1] / "src" / "spatial" / "spatial_analysis.py"
spec = importlib.util.spec_from_file_location("spatial_analysis", MODULE_PATH)
spatial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spatial)


@pytest.fixture
def metadata():
    return pd.DataFrame(
        {
            "StationId": ["A", "B", "C"],
            "Latitude": [19.0, 19.0, 19.05],
            "Longitude": [72.0, 72.05, 72.0],
        }
    )


def test_valid_coordinates(metadata):
    result = spatial.validate_coordinates(metadata)
    assert len(result) == 3


def test_invalid_coordinates_rejected():
    bad = pd.DataFrame({"StationId": ["A"], "Latitude": [91], "Longitude": [72]})
    with pytest.raises(spatial.MissingSpatialMetadataError):
        spatial.validate_coordinates(bad)


def test_missing_coordinates_rejected():
    bad = pd.DataFrame({"StationId": ["A"], "Latitude": [None], "Longitude": [72]})
    with pytest.raises(spatial.MissingSpatialMetadataError):
        spatial.validate_coordinates(bad)


def test_duplicate_station_metadata_rejected(metadata):
    duplicate = pd.concat([metadata, metadata.iloc[[0]]], ignore_index=True)
    with pytest.raises(spatial.MissingSpatialMetadataError):
        spatial.validate_coordinates(duplicate)


def test_station_matching_rejects_unmatched_ids(metadata):
    week5 = pd.DataFrame({"StationId": ["A", "MISSING"], "PM2.5": [1, 2]})
    with pytest.raises(spatial.MissingSpatialMetadataError):
        spatial.match_station_metadata(week5, metadata)


def test_pairwise_distance_and_self_exclusion(metadata):
    result = spatial.pairwise_distances(metadata)
    assert len(result) == 3
    assert (result["distance_km"] >= 0).all()
    assert not (result["station_a"] == result["station_b"]).any()


def test_distance_symmetry(metadata):
    forward = spatial.haversine_km(19.0, 72.0, 19.05, 72.0)
    reverse = spatial.haversine_km(19.05, 72.0, 19.0, 72.0)
    assert forward == pytest.approx(reverse)


def test_nearest_station_is_not_itself(metadata):
    result = spatial.nearest_station_summary(metadata)
    assert not (result["station_id"] == result["nearest_station_id"]).any()


def test_nearby_count_excludes_itself(metadata):
    result = spatial.nearby_station_counts(metadata, radius_km=5)
    assert (result["nearby_station_count"] <= 2).all()
    assert (result["radius_km"] == 5).all()


def test_station_pollution_summary_preserves_ids():
    week5 = pd.DataFrame({"StationId": ["A", "A", "B"], "PM2.5": [10, None, 20]})
    result = spatial.station_pollution_summary(week5)
    assert result["StationId"].tolist() == ["A", "B"]
    assert result.loc[result["StationId"] == "A", "observation_count"].iloc[0] == 1
