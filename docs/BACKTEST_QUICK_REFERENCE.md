# Forecast Backtesting Quick Reference

## Setup

Ensure PostgreSQL is running and `DATABASE_URL` is configured in `.env`:

```bash
python scripts/backtest_forecasts.py
```

## Command-Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--tolerance-minutes` | 30 | Tolerance window (±minutes) for matching observations to predicted_at |
| `--source` | all | Filter by source: "all", "Open-Meteo", or "CPCB" |
| `--output-csv` | None | Optional path to export matched pairs to CSV |

## Common Use Cases

### 1. Full Backtesting (All Sources, Default Tolerance)
```bash
python scripts/backtest_forecasts.py
```
Output: Console summary with MAE/RMSE by horizon and source.

### 2. Evaluate CPCB Accuracy Only
```bash
python scripts/backtest_forecasts.py --source CPCB
```
Excludes Open-Meteo observations; shows only CPCB-based metrics.

### 3. Evaluate Open-Meteo Accuracy Only
```bash
python scripts/backtest_forecasts.py --source Open-Meteo
```
Excludes CPCB observations; shows only Open-Meteo-based metrics.

### 4. Stricter Tolerance (±15 minutes)
```bash
python scripts/backtest_forecasts.py --tolerance-minutes 15
```
Requires observations closer to predicted_at; fewer matches expected.

### 5. Looser Tolerance (±60 minutes)
```bash
python scripts/backtest_forecasts.py --tolerance-minutes 60
```
Allows observations further from predicted_at; more matches expected.

### 6. Export Results to CSV
```bash
python scripts/backtest_forecasts.py --output-csv results.csv
```
Writes matched pairs to CSV for further analysis in Excel/Python.

### 7. Combined: CPCB Only, Strict Tolerance, Export
```bash
python scripts/backtest_forecasts.py --source CPCB --tolerance-minutes 15 --output-csv cpcb_strict.csv
```

## Output Interpretation

### Console Output Example
```
================================================================================
FORECAST BACKTESTING RESULTS
================================================================================

Total matched pairs: 42

Metrics by horizon and source:
--------------------------------------------------------------------------------
Horizon    Source          Count    MAE          RMSE        
--------------------------------------------------------------------------------
1h         CPCB            15       5.23         6.47        
1h         Open-Meteo      12       6.15         7.82        
3h         CPCB            14       7.18         8.91        
3h         Open-Meteo      11       8.42         10.15       
6h         CPCB            13       9.56         11.23       
6h         Open-Meteo      10       10.87        12.64       
--------------------------------------------------------------------------------

Summary by source:
  CPCB: 42 pairs
  Open-Meteo: 33 pairs

================================================================================
```

**Interpretation**:
- **Count**: Number of matched forecast-observation pairs for this (horizon, source).
- **MAE**: Average absolute error in PM2.5 units. Lower is better.
- **RMSE**: Root mean squared error. Penalizes large errors more than MAE.
- **CPCB vs Open-Meteo**: Separate rows show that CPCB and Open-Meteo have different accuracy profiles.

### CSV Output Example
```csv
station,horizon,source,forecast_value,observation_value,error,predicted_at,observation_fetched_at,generated_at,observation_timestamp
MH009,1h,CPCB,55.0,54.5,0.5,2026-10-10T12:00:00,2026-10-10T12:00:00,2026-10-10T11:00:00,2026-10-10 11:00:00
MH009,1h,CPCB,58.0,57.0,1.0,2026-10-10T13:00:00,2026-10-10T13:00:00,2026-10-10T12:00:00,2026-10-10 12:00:00
...
```

**Columns**:
- `station`: CPCB station ID or LIVE_CITY for Open-Meteo.
- `horizon`: 1h, 3h, or 6h.
- `source`: CPCB or Open-Meteo.
- `forecast_value`: Predicted PM2.5.
- `observation_value`: Actual PM2.5.
- `error`: forecast_value - observation_value (positive = overestimate).
- `predicted_at`: Target time for the forecast.
- `observation_fetched_at`: When the observation was recorded.
- `generated_at`: When the forecast was generated.
- `observation_timestamp`: Seed observation timestamp (input to model).

## Matching Rules (What Gets Counted)

A forecast-observation pair is matched if:
1. ✅ Observation is at or after forecast's `generated_at` (no data leakage).
2. ✅ Observation is NOT the seed observation (observation_timestamp).
3. ✅ Observation is within ±tolerance_minutes of `predicted_at`.
4. ✅ If multiple observations qualify, the closest to `predicted_at` is chosen.

A pair is NOT matched if:
- ❌ Observation is before forecast generation.
- ❌ Observation matches the seed observation_timestamp.
- ❌ Observation is outside the tolerance window.
- ❌ No observations exist for the station within tolerance.

## Interpreting Accuracy

### MAE (Mean Absolute Error)
- **Units**: PM2.5 (µg/m³)
- **Interpretation**: On average, forecasts are off by this amount.
- **Example**: MAE=5.23 means forecasts are typically ±5.23 µg/m³ from actual.

### RMSE (Root Mean Squared Error)
- **Units**: PM2.5 (µg/m³)
- **Interpretation**: Similar to MAE but penalizes large errors more.
- **Example**: RMSE=6.47 vs MAE=5.23 suggests some large errors exist.

### Horizon Comparison
- **1h**: Shortest horizon; typically most accurate.
- **3h**: Medium horizon; accuracy degrades.
- **6h**: Longest horizon; typically least accurate.

### Source Comparison
- **CPCB**: Actual sensor readings; typically more accurate.
- **Open-Meteo**: Model-based estimates; typically less accurate.

## Troubleshooting

### "No matched forecast-observation pairs found"
**Possible causes**:
- No forecasts with `predicted_at` in the database (run `/api/forecast/{station}` first).
- No observations within the tolerance window (try `--tolerance-minutes 60`).
- All observations are before forecast generation time.
- All observations match the seed observation_timestamp.

**Solution**: Check that forecasts have been persisted and observations exist in the database.

### "DATABASE_URL is not set"
**Solution**: Configure `.env` with a valid PostgreSQL connection string.

### "Connected to database. Initializing schema..."
**Cause**: Database connection failed.
**Solution**: Verify PostgreSQL is running and `DATABASE_URL` is correct.

## Performance Notes

- Backtesting is I/O-bound (database queries).
- Typical runtime: <1 second for 100 forecasts and 1000 observations.
- CSV export adds minimal overhead.

## Next Steps

1. **Run backtesting** to establish baseline accuracy.
2. **Analyze results** by horizon and source.
3. **Identify patterns** (e.g., CPCB more accurate than Open-Meteo).
4. **Iterate on model** to improve accuracy.
5. **Re-run backtesting** to measure improvements.
