import pandas as pd

raw = pd.read_csv('data/processed/mumbai_pm25_raw.csv')
clean = pd.read_csv('data/processed/clean_air_quality.csv')

raw_rows = len(raw)
clean_rows = len(clean)
rows_removed = raw_rows - clean_rows
# duplicates
exact_dup = int(raw.duplicated().sum())
logical_dup = int(raw.duplicated(subset=['StationId','Datetime']).sum())
# timestamps
raw_ts_invalid = int(pd.to_datetime(raw['Datetime'], errors='coerce').isna().sum())
# pollutant invalid (negative) counts in raw
polls = [c for c in raw.columns if c.upper().startswith('PM') or c.upper() in {'NO2','SO2','CO','O3','NO','NOX','NH3'}]
neg_counts = {}
for p in polls:
    neg_counts[p] = int((pd.to_numeric(raw[p], errors='coerce') < 0).sum())
# missing PM2.5
missing_pm25_raw = int(raw['PM2.5'].isna().sum())
missing_pm25_clean = int(clean['PM2.5'].isna().sum())
# stations
stations_before = int(raw['StationId'].nunique()) if 'StationId' in raw.columns else 0
stations_after = int(clean['StationId'].nunique()) if 'StationId' in clean.columns else 0
# timestamp range
ts_min = pd.to_datetime(clean['Datetime'], errors='coerce').min()
ts_max = pd.to_datetime(clean['Datetime'], errors='coerce').max()

print('RAW_ROWS:', raw_rows)
print('FINAL_ROWS:', clean_rows)
print('ROWS_REMOVED:', rows_removed)
print('EXACT_DUPLICATES_RAW:', exact_dup)
print('LOGICAL_DUPLICATES_RAW:', logical_dup)
print('INVALID_TS_RAW:', raw_ts_invalid)
print('NEGATIVE_POLLUTANT_COUNTS:', neg_counts)
print('MISSING_PM25_RAW:', missing_pm25_raw)
print('MISSING_PM25_CLEAN:', missing_pm25_clean)
print('STATIONS_BEFORE:', stations_before)
print('STATIONS_AFTER:', stations_after)
print('DATE_RANGE_MIN:', ts_min)
print('DATE_RANGE_MAX:', ts_max)
