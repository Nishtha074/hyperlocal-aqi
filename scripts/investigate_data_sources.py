import pandas as pd
import os

# Check date ranges in station_hour.csv for MH/GJ stations
stations = pd.read_csv('data/raw/india_air_quality/stations.csv')
mh_gj_df = stations[stations['State'].isin(['Maharashtra', 'Gujarat'])]
mh_gj_ids = mh_gj_df['StationId'].tolist()

print("MH+GJ stations:")
print(mh_gj_df[['StationId', 'City', 'State']].to_string())

print('\nLoading station_hour (PM2.5 only)...')
sh = pd.read_csv('data/raw/india_air_quality/station_hour.csv',
                 usecols=['StationId', 'Datetime', 'PM2.5'])
sh = sh[sh['StationId'].isin(mh_gj_ids) & sh['PM2.5'].notna()]
sh['Datetime'] = pd.to_datetime(sh['Datetime'])

print('\nDate range and row count per station:')
for sid, grp in sh.groupby('StationId'):
    print(f"  {sid}: {grp['Datetime'].min().date()} to {grp['Datetime'].max().date()} ({len(grp)} rows)")

print('\nOverall date range:')
print(f"  Min: {sh['Datetime'].min().date()}")
print(f"  Max: {sh['Datetime'].max().date()}")

# Now verify city_hour has weather cities for these
print('\n=== Open-Meteo fetch_historical_weather availability ===')
print('The integrate_datasets.py contains fetch_historical_weather(lat, lon, start_date, end_date)')
print('This uses the Open-Meteo Archive API - works for any lat/lon and any historical date range.')

# Check what station coords we can use
print('\n=== Station Coordinates (from known sources) ===')
STATION_COORDS = {
    # Mumbai
    'MH005': ('Bandra', 19.0596, 72.8295),
    'MH006': ('Borivali East', 19.2313, 72.8527),
    'MH007': ('CSIA T2', 19.0943, 72.8742),
    'MH008': ('Colaba', 18.9150, 72.8216),
    'MH009': ('Kurla', 19.0837, 72.8842),
    'MH010': ('Powai', 19.1270, 72.9090),
    'MH011': ('Sion', 19.0474, 72.8637),
    'MH012': ('Vasai West', 19.3919, 72.8397),
    'MH013': ('Vile Parle West', 19.1089, 72.8468),
    'MH014': ('Worli', 19.0096, 72.8177),
    # Non-Mumbai Maharashtra
    'MH001': ('Aurangabad', 19.8762, 75.3433),
    'MH002': ('Chandrapur', 19.9615, 79.2961),
    'MH003': ('Chandrapur MIDC', 19.9200, 79.3010),
    'MH004': ('Kalyan', 19.2403, 73.1305),
    'MH015': ('Nagpur', 21.1458, 79.0882),
    'MH016': ('Nashik', 19.9975, 73.7898),
    'MH017': ('Navi Mumbai Airoli', 19.1583, 72.9998),
    'MH018': ('Navi Mumbai Mahape', 19.1090, 73.0140),
    'MH019': ('Navi Mumbai Nerul', 19.0330, 73.0297),
    'MH020': ('Pune Karve Road', 18.5204, 73.8433),
    'MH021': ('Solapur', 17.6825, 75.9064),
    'MH022': ('Thane', 19.2183, 72.9781),
    # Gujarat
    'GJ001': ('Ahmedabad Maninagar', 22.9932, 72.6034),
    'GJ002': ('Ankleshwar GIDC', 21.6264, 73.0152),
    'GJ003': ('Gandhinagar Sector-10', 23.2156, 72.6369),
    'GJ004': ('Nandesari GIDC', 22.4042, 73.0991),
    'GJ005': ('Vapi GIDC', 20.3893, 72.9106),
    'GJ006': ('Vatva GIDC', 22.9511, 72.6074),
}

print(f"Coords available for {len(STATION_COORDS)} of {len(mh_gj_ids)} stations")
for sid in mh_gj_ids:
    if sid in STATION_COORDS:
        name, lat, lon = STATION_COORDS[sid]
        print(f"  {sid} ({name}): lat={lat}, lon={lon}")
    else:
        print(f"  {sid}: NO COORDS")
