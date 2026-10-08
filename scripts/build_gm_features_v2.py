"""
Build gm_features_v2.csv - Correct Regional Dataset
-------------------------------------------------------
Fixes all v1 issues:
1. Real coordinates for all 28 MH+GJ stations
2. Real weather from Open-Meteo Archive API per station (via group-based lat/lon)
3. Real nearby_station_PM25 using actual Haversine distances
4. no2_satellite dropped (not available outside Mumbai)
5. Only stations with actual PM2.5 data included
"""
import os
import sys
import time
import requests
import pandas as pd
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.forecasting.feature_engineering import TimeSeriesFeatureEngineer

# -----------------------------------------------------------------------
# STATION COORDINATES (sourced from CPCB / Open Knowledge)
# -----------------------------------------------------------------------
STATION_COORDS = {
    'GJ001': (22.9932, 72.6034),   # Ahmedabad Maninagar
    'GJ002': (21.6264, 73.0152),   # Ankleshwar GIDC
    'GJ003': (23.2156, 72.6369),   # Gandhinagar Sector-10
    'GJ004': (22.4042, 73.0991),   # Nandesari GIDC
    'GJ005': (20.3893, 72.9106),   # Vapi GIDC
    'GJ006': (22.9511, 72.6074),   # Vatva GIDC
    'MH001': (19.8762, 75.3433),   # Aurangabad
    'MH002': (19.9615, 79.2961),   # Chandrapur
    'MH003': (19.9200, 79.3010),   # Chandrapur MIDC
    'MH004': (19.2403, 73.1305),   # Kalyan
    'MH005': (19.0596, 72.8295),   # Bandra
    'MH006': (19.2313, 72.8527),   # Borivali East
    'MH007': (19.0943, 72.8742),   # CSIA T2
    'MH008': (18.9150, 72.8216),   # Colaba
    'MH009': (19.0837, 72.8842),   # Kurla
    'MH010': (19.1270, 72.9090),   # Powai
    'MH011': (19.0474, 72.8637),   # Sion
    'MH012': (19.3919, 72.8397),   # Vasai West
    'MH013': (19.1089, 72.8468),   # Vile Parle West
    'MH014': (19.0096, 72.8177),   # Worli
    'MH015': (21.1458, 79.0882),   # Nagpur
    'MH016': (19.9975, 73.7898),   # Nashik
    'MH017': (19.1583, 72.9998),   # Navi Mumbai Airoli
    'MH018': (19.1090, 73.0140),   # Navi Mumbai Mahape
    'MH019': (19.0330, 73.0297),   # Navi Mumbai Nerul
    'MH020': (18.5204, 73.8433),   # Pune
    'MH021': (17.6825, 75.9064),   # Solapur
    'MH022': (19.2183, 72.9781),   # Thane
}


def fetch_weather_for_station(station_id, lat, lon, start_date, end_date, retries=3):
    """Fetch hourly weather from Open-Meteo Archive API for a specific lat/lon."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "surface_pressure",
            "wind_speed_10m",
            "wind_direction_10m",
            "cloud_cover"
        ],
        "timezone": "Asia/Kolkata"
    }

    rename_cols = {
        "time": "Datetime",
        "temperature_2m": "Temperature",
        "relative_humidity_2m": "Humidity",
        "precipitation": "Rainfall",
        "surface_pressure": "Pressure",
        "wind_speed_10m": "WindSpeed",
        "wind_direction_10m": "WindDirection",
        "cloud_cover": "CloudCover"
    }

    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            df = pd.DataFrame(data["hourly"]).rename(columns=rename_cols)
            df["Datetime"] = pd.to_datetime(df["Datetime"]).dt.tz_localize(None)
            df["StationId"] = station_id
            return df
        except Exception as e:
            print(f"  Attempt {attempt+1}/{retries} failed for {station_id}: {e}")
            time.sleep(2 ** attempt)

    print(f"  WARNING: All attempts failed for {station_id}, skipping weather.")
    return None


def main():
    os.makedirs("data/features", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)

    # -----------------------------------------------------------------------
    # STEP 1: Load station metadata and PM2.5 data
    # -----------------------------------------------------------------------
    print("="*60)
    print("STEP 1: Loading Station Hour PM2.5 Data")
    print("="*60)

    stations_df = pd.read_csv("data/raw/india_air_quality/stations.csv")
    mh_gj_df = stations_df[stations_df['State'].isin(['Maharashtra', 'Gujarat'])]
    mh_gj_ids = mh_gj_df['StationId'].tolist()

    sh = pd.read_csv("data/raw/india_air_quality/station_hour.csv",
                     usecols=['StationId', 'Datetime', 'PM2.5'])
    sh = sh[sh['StationId'].isin(mh_gj_ids) & sh['PM2.5'].notna()]
    sh['Datetime'] = pd.to_datetime(sh['Datetime'])

    active_stations = sorted(sh['StationId'].unique())
    print(f"Stations with PM2.5 data: {active_stations} ({len(active_stations)} total)")

    overall_start = sh['Datetime'].min().strftime('%Y-%m-%d')
    overall_end   = sh['Datetime'].max().strftime('%Y-%m-%d')
    print(f"Date range: {overall_start} to {overall_end}")

    # -----------------------------------------------------------------------
    # STEP 2: Add real coordinates
    # -----------------------------------------------------------------------
    print("\n" + "="*60)
    print("STEP 2: Injecting Real Coordinates")
    print("="*60)

    sh['Latitude']  = sh['StationId'].map(lambda s: STATION_COORDS.get(s, (None, None))[0])
    sh['Longitude'] = sh['StationId'].map(lambda s: STATION_COORDS.get(s, (None, None))[1])

    missing_coords = sh[sh['Latitude'].isna()]['StationId'].unique()
    if len(missing_coords) > 0:
        print(f"WARNING: Missing coords for {missing_coords} - dropping them")
        sh = sh[sh['Latitude'].notna()]
    else:
        print(f"All {len(active_stations)} stations have valid coordinates.")

    print(sh.groupby('StationId')[['Latitude','Longitude']].first().to_string())

    # -----------------------------------------------------------------------
    # STEP 3: Fetch weather per station (group nearby stations by unique coords)
    # -----------------------------------------------------------------------
    print("\n" + "="*60)
    print("STEP 3: Fetching Historical Weather from Open-Meteo")
    print("="*60)

    # Cache weather by coord cluster (stations <0.5km apart can share weather)
    weather_cache = {}
    all_weather = []

    for sid in active_stations:
        if sid not in STATION_COORDS:
            print(f"  Skipping {sid} - no coords")
            continue

        lat, lon = STATION_COORDS[sid]
        st_data = sh[sh['StationId'] == sid]
        start = st_data['Datetime'].min().strftime('%Y-%m-%d')
        end   = st_data['Datetime'].max().strftime('%Y-%m-%d')

        cache_key = (round(lat, 2), round(lon, 2))

        if cache_key in weather_cache:
            print(f"  {sid}: Using cached weather for {cache_key}")
            w = weather_cache[cache_key].copy()
            w['StationId'] = sid
        else:
            print(f"  {sid}: Fetching weather lat={lat}, lon={lon}, {start} to {end}...")
            w = fetch_weather_for_station(sid, lat, lon, start, end)
            if w is not None:
                weather_cache[cache_key] = w.copy()

        if w is not None:
            all_weather.append(w)

    if all_weather:
        weather_df = pd.concat(all_weather, ignore_index=True)
        weather_df['Datetime'] = pd.to_datetime(weather_df['Datetime'])
        print(f"\nWeather fetched: {len(weather_df)} rows across {weather_df['StationId'].nunique()} stations")
        print(weather_df[['StationId','Temperature','Humidity','WindSpeed','Pressure']].describe())
    else:
        print("ERROR: No weather data fetched. Cannot proceed.")
        return

    # -----------------------------------------------------------------------
    # STEP 4: Merge PM2.5 with weather on StationId + Datetime
    # -----------------------------------------------------------------------
    print("\n" + "="*60)
    print("STEP 4: Merging PM2.5 with Weather")
    print("="*60)

    df = sh.merge(weather_df[['StationId','Datetime','Temperature','Humidity',
                               'Rainfall','Pressure','WindSpeed','WindDirection','CloudCover']],
                  on=['StationId','Datetime'], how='left')

    missing_wx = df['Temperature'].isna().sum()
    print(f"Rows after merge: {len(df)}")
    print(f"Rows with missing weather: {missing_wx} ({missing_wx/len(df)*100:.1f}%)")

    # Forward-fill small gaps in weather (up to 2h)
    for col in ['Temperature','Humidity','Rainfall','Pressure','WindSpeed','WindDirection','CloudCover']:
        df[col] = df.groupby('StationId')[col].transform(lambda x: x.ffill(limit=2).bfill(limit=2))

    missing_after = df['Temperature'].isna().sum()
    print(f"Rows with missing weather after fill: {missing_after}")

    # Drop rows still missing weather
    df = df.dropna(subset=['Temperature', 'PM2.5'])
    print(f"Rows after dropping missing: {len(df)}")

    # -----------------------------------------------------------------------
    # STEP 5: Feature Engineering with real coords + real weather
    # -----------------------------------------------------------------------
    print("\n" + "="*60)
    print("STEP 5: Running Feature Engineering")
    print("="*60)

    engineer = TimeSeriesFeatureEngineer(nearby_radius_km=50.0)  # 50km for regional model
    df_features = engineer.run_all(df)

    # Add PM2.5 roll 6h (not in default feature engineer)
    df_features["pm25_roll_6h"] = df_features.groupby("StationId")["PM2.5"].transform(
        lambda x: x.shift(1).rolling(window=6, min_periods=1).mean()
    )
    df_features["temp_roll_6h"] = df_features.groupby("StationId")["Temperature"].transform(
        lambda x: x.shift(1).rolling(window=6, min_periods=1).mean()
    )
    df_features["humidity_roll_6h"] = df_features.groupby("StationId")["Humidity"].transform(
        lambda x: x.shift(1).rolling(window=6, min_periods=1).mean()
    )
    df_features["wind_speed_roll_6h"] = df_features.groupby("StationId")["WindSpeed"].transform(
        lambda x: x.shift(1).rolling(window=6, min_periods=1).mean()
    )

    # -----------------------------------------------------------------------
    # STEP 6: Station dummies
    # -----------------------------------------------------------------------
    df_features = pd.get_dummies(df_features, columns=["StationId"], drop_first=False)
    for col in df_features.columns:
        if col.startswith('StationId_'):
            df_features[col] = df_features[col].astype(int)

    # -----------------------------------------------------------------------
    # STEP 7: Define final feature cols (no no2_satellite - not available)
    # -----------------------------------------------------------------------
    FEATURE_COLS = [
        "PM25_lag_1", "PM25_lag_2", "PM25_lag_3", "PM25_lag_6", "PM25_lag_12", "PM25_lag_24",
        "pm25_roll_3h", "pm25_roll_6h",
        "Temperature", "Humidity", "WindSpeed", "Rainfall", "Pressure", "CloudCover", "WindDirection",
        "temp_roll_3h", "temp_roll_6h", "humidity_roll_3h", "humidity_roll_6h",
        "wind_speed_roll_3h", "wind_speed_roll_6h",
        "temp_change_1h", "humidity_change_1h", "wind_speed_change_1h",
        "hour", "day", "month", "day_of_week", "is_weekend",
        "sin_hour", "cos_hour", "sin_month", "cos_month",
        "Latitude", "Longitude", "nearby_station_PM25",
    ]

    station_dummy_cols = [c for c in df_features.columns if c.startswith('StationId_')]
    ALL_FEATURE_COLS = FEATURE_COLS + station_dummy_cols
    TARGET_COL = "target_PM25_1h"

    for c in FEATURE_COLS:
        if c not in df_features.columns:
            df_features[c] = 0.0

    # Drop incomplete rows
    df_ready = df_features.dropna(subset=ALL_FEATURE_COLS + [TARGET_COL])
    print(f"\nDataset shape after feature engineering: {df_ready.shape}")
    print(f"Stations represented: {[c.replace('StationId_','') for c in station_dummy_cols]}")

    # -----------------------------------------------------------------------
    # STEP 8: Dataset Validation (Task 5)
    # -----------------------------------------------------------------------
    print("\n" + "="*60)
    print("TASK 5: DATASET VALIDATION")
    print("="*60)

    check_cols = ["Latitude", "Longitude", "Temperature", "Humidity", "WindSpeed", "nearby_station_PM25"]
    print("\nKey Feature Statistics:")
    print(df_ready[check_cols].describe().to_string())

    print("\nMissing values per feature:")
    missing = df_ready[ALL_FEATURE_COLS + [TARGET_COL]].isna().sum()
    print(missing[missing > 0].to_string() if missing.sum() > 0 else "  None - all features complete!")

    print("\nWeather feature sanity:")
    for col in ['Temperature', 'Humidity', 'WindSpeed', 'Rainfall', 'Pressure']:
        std = df_ready[col].std()
        pct_zero = (df_ready[col] == 0).sum() / len(df_ready) * 100
        print(f"  {col}: mean={df_ready[col].mean():.2f}, std={std:.2f}, %zeros={pct_zero:.1f}%")
        if std < 0.01:
            print(f"    *** WARNING: {col} is still nearly constant! ***")

    print("\nStation balance:")
    for c in station_dummy_cols:
        print(f"  {c}: {df_ready[c].sum()} samples")

    # -----------------------------------------------------------------------
    # STEP 9: Save
    # -----------------------------------------------------------------------
    save_cols = ALL_FEATURE_COLS + [TARGET_COL]
    df_ready[save_cols].to_csv("data/features/gm_features_v2.csv", index=False)
    print(f"\nSaved: data/features/gm_features_v2.csv ({len(df_ready)} rows, {len(save_cols)} cols)")
    print("\nDataset is ready for training. Run the retraining script next.")


if __name__ == "__main__":
    main()
