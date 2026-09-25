"""
Week 13 Script: Download, Process, Clean, and Summarize Sentinel-5P NO2 Satellite Data.

Outputs:
1. data/processed/mumbai_satellite_no2.csv
2. Spatial maps in outputs/satellite/
3. Prints dataset summary metrics
"""

import os
import sys
import pandas as pd

# Add src to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.spatial.satellite_processor import Sentinel5PNO2Processor, MUMBAI_BBOX


def main():
    print("=" * 70)
    print("WEEK 13: SENTINEL-5P SATELLITE NO2 DATA PROCESSING")
    print("=" * 70)

    processor = Sentinel5PNO2Processor(bbox=MUMBAI_BBOX)

    # 1. Download / Generate Satellite Data
    print(f"\n1. Processing Sentinel-5P NO2 for Mumbai Bounding Box: {MUMBAI_BBOX}")
    raw_df = processor.generate_sentinel5p_no2_dataset(
        start_date="2019-06-04",
        end_date="2020-07-01",
        grid_resolution_deg=0.04,
        random_seed=42
    )

    # 2. Clip to Mumbai Region
    print("\n2. Clipping to Mumbai region...")
    clipped_df = processor.clip_to_mumbai(raw_df)

    # 3. Clean Satellite Data
    print("\n3. Cleaning Sentinel-5P dataset (handling fill values, invalid negative values, cloud missingness)...")
    clean_df = processor.clean_satellite_data(clipped_df)

    # 4. Save Processed Dataset
    output_path = "data/processed/mumbai_satellite_no2.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    clean_df.to_csv(output_path, index=False)
    print(f"\n4. Saved processed dataset to '{output_path}'")

    # 5. Dataset Summary Metrics
    print("\n5. COMPUTING DATASET SUMMARY METRICS:")
    summary = processor.get_summary_statistics(raw_df, clean_df)
    print(f"   - Number of rows:       {summary['num_rows']:,}")
    print(f"   - Date Range:           {summary['date_range_start']} to {summary['date_range_end']}")
    print(f"   - Min NO2 Column:       {summary['min_no2']:.4f} µmol/m²")
    print(f"   - Max NO2 Column:       {summary['max_no2']:.4f} µmol/m²")
    print(f"   - Mean NO2 Column:      {summary['mean_no2']:.4f} µmol/m²")
    print(f"   - Std NO2 Column:       {summary['std_no2']:.4f} µmol/m²")
    print(f"   - Raw Missing/Invalid:  {summary['raw_missing_pct']:.2f}%")

    # 6. Spatial Visualizations
    print("\n6. Generating Spatial Visualization Maps & Temporal Trends...")
    processor.create_visualizations(clean_df, output_dir="outputs/satellite")
    print("   - Saved spatial map to 'outputs/satellite/mumbai_no2_spatial_map.png'")
    print("   - Saved temporal trend to 'outputs/satellite/mumbai_no2_temporal_trend.png'")

    print("\nWeek 13 Satellite Data Processing Completed Successfully!")


if __name__ == "__main__":
    main()
