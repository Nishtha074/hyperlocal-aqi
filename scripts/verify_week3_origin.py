import pandas as pd

raw_path = 'data/processed/mumbai_pm25_raw.csv'
clean_path = 'data/processed/clean_air_quality.csv'

raw = pd.read_csv(raw_path)
clean = pd.read_csv(clean_path)

# Ensure same number of rows and same ordering by StationId+Datetime if present
if set(['StationId','Datetime']).issubset(raw.columns) and set(['StationId','Datetime']).issubset(clean.columns):
    raw_keyed = raw.set_index(['StationId','Datetime'])
    clean_keyed = clean.set_index(['StationId','Datetime'])
    common_index = raw_keyed.index.intersection(clean_keyed.index)
else:
    # fallback to positional comparison
    raw_keyed = raw
    clean_keyed = clean
    common_index = range(min(len(raw), len(clean)))

# Missing PM2.5 counts
missing_raw = int(raw['PM2.5'].isna().sum())
missing_clean = int(clean['PM2.5'].isna().sum())

# Compare PM2.5 values for rows present in both
mismatches = []
filled_in_clean = []
removed_in_clean = []

for idx in common_index:
    try:
        raw_val = raw_keyed.loc[idx]['PM2.5']
        clean_val = clean_keyed.loc[idx]['PM2.5']
    except Exception:
        # positional fallback
        raw_val = raw.loc[idx, 'PM2.5']
        clean_val = clean.loc[idx, 'PM2.5']

    # Normalize NaN checks
    raw_nan = pd.isna(raw_val)
    clean_nan = pd.isna(clean_val)

    if not raw_nan and not clean_nan:
        # compare numeric equivalence as floats
        try:
            if float(raw_val) != float(clean_val):
                mismatches.append((idx, raw_val, clean_val))
        except Exception:
            if str(raw_val) != str(clean_val):
                mismatches.append((idx, raw_val, clean_val))
    elif raw_nan and not clean_nan:
        filled_in_clean.append((idx, clean_val))
    elif (not raw_nan) and clean_nan:
        removed_in_clean.append((idx, raw_val))

# Differences in columns
cols_raw = set(raw.columns.tolist())
cols_clean = set(clean.columns.tolist())
added_cols = cols_clean - cols_raw
removed_cols = cols_raw - cols_clean

print('missing_pm25_raw:', missing_raw)
print('missing_pm25_clean:', missing_clean)
print('mismatches_count:', len(mismatches))
print('filled_in_clean_count (raw missing -> clean present):', len(filled_in_clean))
print('removed_in_clean_count (raw present -> clean missing):', len(removed_in_clean))
print('added_columns_in_clean:', sorted(list(added_cols)))
print('removed_columns_in_clean:', sorted(list(removed_cols)))

# show up to 10 mismatches and fills
if mismatches:
    print('\nSample mismatches:')
    for m in mismatches[:10]:
        print(m)
if filled_in_clean:
    print('\nSample filled_in_clean:')
    for m in filled_in_clean[:10]:
        print(m)
if removed_in_clean:
    print('\nSample removed_in_clean:')
    for m in removed_in_clean[:10]:
        print(m)

# Quick assertion style outputs
print('\nAssertions:')
print('PM2.5 unchanged for all non-missing rows:', len(mismatches) == 0)
print('No imputation performed (no raw-missing then clean-present):', len(filled_in_clean) == 0)
print('No unexpected removals of PM2.5 values:', len(removed_in_clean) >= 0)
