# Step 2: Forecast Backtesting - Implementation Complete

## Summary

Successfully implemented a standalone forecast backtesting script that matches persisted forecasts against later observations and computes MAE/RMSE separately by horizon and observation source. The implementation is read-only, prevents data leakage, and maintains strict separation between CPCB and Open-Meteo sources.

## Files Created

### 1. `scripts/backtest_forecasts.py`
- **Lines**: ~350
- **Purpose**: Standalone backtesting script with configurable matching rules and source filtering
- **Key Components**:
  - `backtest_forecasts()`: Main async orchestrator
  - `_match_forecasts_to_observations()`: Implements 6 matching rules
  - `_compute_metrics()`: Computes MAE/RMSE by (horizon, source)
  - `_print_summary()`: Readable console output
  - `_write_csv()`: Optional CSV export
- **Command-line Interface**:
  - `--tolerance-minutes` (default: 30)
  - `--source` (default: all)
  - `--output-csv` (optional)

### 2. `tests/test_backtest_forecasts.py`
- **Lines**: ~450
- **Tests**: 15 comprehensive test cases
- **Coverage**:
  - Exact target-time matching
  - Tolerance window matching
  - Exclusion of out-of-tolerance observations
  - Data leakage prevention
  - Seed observation exclusion
  - Closest observation selection
  - Source-specific metrics
  - Horizon-specific metrics
  - Empty database handling
  - NULL source handling
  - Source filtering
  - MAE/RMSE computation

### 3. `docs/BACKTEST_IMPLEMENTATION.md`
- Comprehensive technical documentation
- Matching rules with rationale
- Source handling details
- Metrics computation formulas
- Output format examples
- Read-only design justification
- Test coverage summary
- Usage examples
- Key insights and limitations

### 4. `docs/BACKTEST_QUICK_REFERENCE.md`
- Quick reference guide for users
- Command-line options table
- Common use cases with examples
- Output interpretation guide
- Troubleshooting section
- Performance notes

## Matching Rules (6 Rules)

### Rule 1: Target Time Identification
- **Use `predicted_at`** to identify the target observation time
- **Not `observation_timestamp`** (which is the seed observation)
- **Rationale**: `predicted_at = generated_at + horizon_delta` represents when the forecast was meant to predict

### Rule 2: Data Leakage Prevention
- **Observation must be at or after `generated_at`**
- **Rationale**: Prevents using information that didn't exist at forecast generation time

### Rule 3: Seed Observation Exclusion
- **Never use observation matching `observation_timestamp` as outcome**
- **Rationale**: Seed observation is the model input, not ground truth

### Rule 4: Closest Valid Observation
- **If multiple observations qualify, choose the closest to `predicted_at`**
- **Rationale**: Minimizes temporal distance between prediction target and actual observation

### Rule 5: Tolerance Window
- **Observation must be within ±tolerance_minutes of `predicted_at`**
- **Default**: 30 minutes (configurable)
- **Rationale**: Allows realistic observation timing variations while maintaining forecast relevance

### Rule 6: Avoid Duplicate Counting
- **Each forecast matched to at most one observation**
- **Implementation**: Matching loop selects single best observation per forecast

## Source Handling

### Source Labeling
| Source | Condition | Meaning |
|--------|-----------|---------|
| CPCB | `source='CPCB'` or `source IS NULL` | Actual station sensor readings |
| Open-Meteo | `source='Open-Meteo'` | City-level model-based estimates |

### Separate Metrics
- Metrics computed independently for each source
- Results never merged or combined
- `--source` filter excludes non-matching observations
- NULL source treated as CPCB (backward compatibility)

### Why Separate?
- CPCB: Precise station-level measurements
- Open-Meteo: Regional model estimates
- Different accuracy profiles require separate evaluation

## Metrics Computation

### MAE (Mean Absolute Error)
```
MAE = (1/n) * Σ|forecast_value - observation_value|
```
- **Units**: PM2.5 (µg/m³)
- **Interpretation**: Average absolute error
- **Lower is better**

### RMSE (Root Mean Squared Error)
```
RMSE = sqrt((1/n) * Σ(forecast_value - observation_value)²)
```
- **Units**: PM2.5 (µg/m³)
- **Interpretation**: Penalizes large errors more than MAE
- **Lower is better**

### Reporting
- Separate results for each (horizon, source) combination
- When count=0, mae=None and rmse=None
- Never reports zero error when no pairs exist

## Test Results

### All Tests Pass: 159/159 ✅

**Breakdown**:
- 144 pre-existing tests (unchanged)
- 15 new backtesting tests (all passing)

**Test Coverage**:
- ✅ Exact target-time match
- ✅ Match within tolerance
- ✅ No observation within tolerance
- ✅ Exclusion of observations before forecast generation
- ✅ Exclusion of the seed observation
- ✅ Multiple candidate observations: choose closest
- ✅ Separate source-specific metrics
- ✅ Separate results for all three horizons
- ✅ Empty database / zero matched pairs
- ✅ Missing or NULL source handling
- ✅ Source filtering (Open-Meteo only)
- ✅ Source filtering (CPCB only)
- ✅ MAE computation correctness
- ✅ RMSE computation correctness
- ✅ Insufficient data result

## Read-Only Design

The script is intentionally read-only:
- ❌ Does NOT write to `model_metrics` table
- ❌ Does NOT modify production tables
- ❌ Does NOT change model code
- ✅ Suitable for evaluation and analysis without affecting production

**Future Enhancement**: Could add `--persist` flag to optionally store results.

## Usage Examples

### Basic backtesting
```bash
python scripts/backtest_forecasts.py
```

### CPCB only, strict tolerance
```bash
python scripts/backtest_forecasts.py --source CPCB --tolerance-minutes 15
```

### Open-Meteo only, export to CSV
```bash
python scripts/backtest_forecasts.py --source Open-Meteo --output-csv results.csv
```

### Loose tolerance, all sources
```bash
python scripts/backtest_forecasts.py --tolerance-minutes 60
```

## Output Example

### Console Summary
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

### CSV Export
```csv
station,horizon,source,forecast_value,observation_value,error,predicted_at,observation_fetched_at,generated_at,observation_timestamp
MH009,1h,CPCB,55.0,54.5,0.5,2026-10-10T12:00:00,2026-10-10T12:00:00,2026-10-10T11:00:00,2026-10-10 11:00:00
MH009,1h,CPCB,58.0,57.0,1.0,2026-10-10T13:00:00,2026-10-10T13:00:00,2026-10-10T12:00:00,2026-10-10 12:00:00
```

## Key Insights

1. **Uniqueness Strategy**: `(station, horizon, predicted_at)` is the correct uniqueness key. Same station+horizon can legitimately be requested again an hour later (targeting different `predicted_at`).

2. **Forecast Persistence**: Both CPCB and Open-Meteo paths persist forecasts via shared `_persist_forecasts()` helper. Helper computes `predicted_at` from `generated_at + horizon_delta`, stores actual seed observation timestamp, uses ON CONFLICT upsert.

3. **Source Separation**: CPCB and Open-Meteo are fundamentally different:
   - CPCB: Actual station sensor readings
   - Open-Meteo: City-level model-based estimates
   - Metrics must never be merged

4. **Data Leakage Prevention**: Matching rules strictly prevent using information that wouldn't have been available at forecast generation time. This ensures backtesting results reflect real-world forecast performance.

5. **Seed Observation Exclusion**: The observation used to generate the forecast is never used as the ground truth. This prevents circular evaluation.

## Verification Checklist

- ✅ Standalone script created (`scripts/backtest_forecasts.py`)
- ✅ Comprehensive tests created (`tests/test_backtest_forecasts.py`)
- ✅ All 15 new tests pass
- ✅ All 144 pre-existing tests still pass (159/159 total)
- ✅ Matching rules prevent data leakage
- ✅ Seed observation never used as outcome
- ✅ Source-specific metrics computed separately
- ✅ Horizon-specific metrics computed separately
- ✅ Read-only design (no production table modifications)
- ✅ Configurable tolerance window
- ✅ Configurable source filtering
- ✅ Optional CSV export
- ✅ Clear console summary output
- ✅ Comprehensive documentation
- ✅ Quick reference guide

## Next Steps

1. **Run backtesting** to establish baseline accuracy
2. **Analyze results** by horizon and source
3. **Identify patterns** (e.g., accuracy degradation over horizon)
4. **Iterate on model** to improve accuracy
5. **Re-run backtesting** to measure improvements
6. **Consider persistence** (future enhancement to store results in `model_metrics`)

## Documentation

- **Technical Details**: `docs/BACKTEST_IMPLEMENTATION.md`
- **Quick Reference**: `docs/BACKTEST_QUICK_REFERENCE.md`
- **Code**: `scripts/backtest_forecasts.py`
- **Tests**: `tests/test_backtest_forecasts.py`
