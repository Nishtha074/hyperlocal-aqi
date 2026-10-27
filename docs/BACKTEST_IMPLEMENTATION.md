# Step 2: Forecast Backtesting Implementation Summary

## Overview

Implemented a standalone forecast backtesting script (`scripts/backtest_forecasts.py`) that matches persisted forecasts against later observations and computes MAE/RMSE separately by horizon and observation source. The script is read-only and does not modify production tables or model code.

## Files Changed

### 1. `scripts/backtest_forecasts.py` (NEW)
- **Purpose**: Standalone backtesting script with configurable matching rules and source filtering.
- **Key Functions**:
  - `backtest_forecasts()`: Main async function orchestrating the backtesting workflow.
  - `_match_forecasts_to_observations()`: Implements matching rules with data leakage prevention.
  - `_compute_metrics()`: Computes MAE and RMSE by (horizon, source) combination.
  - `_print_summary()`: Prints readable summary of results.
  - `_write_csv()`: Optionally exports matched pairs to CSV.
- **Command-line Options**:
  - `--tolerance-minutes` (default: 30): Tolerance window for matching.
  - `--source` (default: all): Filter by "all", "Open-Meteo", or "CPCB".
  - `--output-csv`: Optional path to write matched pairs.

### 2. `tests/test_backtest_forecasts.py` (NEW)
- **15 comprehensive tests** covering:
  - Exact target-time matching
  - Tolerance window matching (±30 minutes)
  - Exclusion of observations outside tolerance
  - Data leakage prevention (observations before forecast generation)
  - Seed observation exclusion (never use input observation as outcome)
  - Closest observation selection (when multiple qualify)
  - Source-specific metrics (CPCB vs Open-Meteo)
  - Horizon-specific metrics (1h, 3h, 6h)
  - Empty database handling
  - NULL source handling (treated as CPCB)
  - Source filtering (Open-Meteo only, CPCB only)
  - MAE and RMSE computation correctness
  - Insufficient data results

## Matching Rules

### 1. Target Time Identification
- **Rule**: Use `predicted_at` to identify the target observation time.
- **Rationale**: `predicted_at` is computed as `generated_at + horizon_delta` and represents when the forecast was meant to predict. `observation_timestamp` identifies the seed observation used to generate the prediction, not the future outcome.

### 2. Data Leakage Prevention
- **Rule**: Matched observation must be at or after forecast's `generated_at`.
- **Rationale**: Prevents using observations that existed before the forecast was generated.

### 3. Seed Observation Exclusion
- **Rule**: Never use an observation matching `observation_timestamp` as the forecast outcome.
- **Rationale**: The seed observation is the input to the model, not the ground truth for evaluation.

### 4. Closest Valid Observation
- **Rule**: If multiple observations qualify, choose the closest to `predicted_at`.
- **Rationale**: Minimizes temporal distance between prediction target and actual observation.

### 5. Tolerance Window
- **Rule**: Observation must be within ±tolerance_minutes of `predicted_at`.
- **Default**: 30 minutes (configurable).
- **Rationale**: Allows for realistic observation timing variations while maintaining forecast relevance.

### 6. Avoid Duplicate Counting
- **Rule**: Each forecast is matched to at most one observation.
- **Implementation**: Matching loop selects the single best observation per forecast.

## Source Handling

### Source Labeling
- **CPCB**: Rows with `source='CPCB'` or `source IS NULL` (legacy CPCB rows).
- **Open-Meteo**: Rows with `source='Open-Meteo'`.

### Separate Metrics
- Metrics are computed independently for each source.
- Results are never merged or combined.
- When `--source` filter is applied, only matching observations are considered.

### NULL Source Handling
- Observations with `source=NULL` are treated as CPCB (legacy behavior).
- This preserves backward compatibility with pre-source-labeling data.

## Metrics Computation

### MAE (Mean Absolute Error)
```
MAE = (1/n) * Σ|forecast_value - observation_value|
```

### RMSE (Root Mean Squared Error)
```
RMSE = sqrt((1/n) * Σ(forecast_value - observation_value)²)
```

### Reporting
- Metrics are reported separately for each (horizon, source) combination.
- When no pairs exist for a combination, count=0 and mae/rmse=None.
- Never reports zero error when there are no pairs.

## Output Format

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

### CSV Export (Optional)
Columns: station, horizon, source, forecast_value, observation_value, error, predicted_at, observation_fetched_at, generated_at, observation_timestamp

## Read-Only Design

The script is intentionally read-only:
- Does not write to `model_metrics` table.
- Does not modify production tables.
- Does not change model code.
- Suitable for evaluation and analysis without affecting production systems.

## Test Results

All 159 tests pass:
- 144 pre-existing tests (unchanged)
- 15 new backtesting tests (all passing)

### Test Coverage
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

## Usage Examples

### Basic backtesting with default settings
```bash
python scripts/backtest_forecasts.py
```

### Custom tolerance window (60 minutes)
```bash
python scripts/backtest_forecasts.py --tolerance-minutes 60
```

### Evaluate only CPCB observations
```bash
python scripts/backtest_forecasts.py --source CPCB
```

### Evaluate only Open-Meteo observations
```bash
python scripts/backtest_forecasts.py --source Open-Meteo
```

### Export matched pairs to CSV
```bash
python scripts/backtest_forecasts.py --output-csv results.csv
```

### Combined options
```bash
python scripts/backtest_forecasts.py --tolerance-minutes 45 --source CPCB --output-csv cpcb_results.csv
```

## Key Insights

1. **Uniqueness Strategy**: `(station, horizon, predicted_at)` is the correct uniqueness key for forecasts. Same station+horizon can legitimately be requested again an hour later (targeting different `predicted_at`).

2. **Forecast Persistence Architecture**: Both CPCB and Open-Meteo fallback paths persist forecasts via shared `_persist_forecasts()` helper. Helper computes `predicted_at` from `generated_at + horizon_delta`, stores actual seed observation timestamp, uses ON CONFLICT upsert.

3. **Database Connection Handling**: `_persist_forecasts()` manages its own connection lifecycle (get_conn, execute 3 times, close in finally block). This prevents double-close issues and keeps persistence logic isolated from API response path.

4. **Source Separation**: CPCB and Open-Meteo observations are fundamentally different:
   - CPCB: Actual station sensor readings with precise timestamps.
   - Open-Meteo: City-level model-based estimates.
   - Metrics must never be merged; separate evaluation is essential.

5. **Data Leakage Prevention**: The matching rules strictly prevent using information that wouldn't have been available at forecast generation time. This ensures backtesting results reflect real-world forecast performance.

## Limitations and Future Work

1. **No Persistence**: Results are not written to `model_metrics` table. Future work could add `--persist` flag to store results.

2. **No Confidence Intervals**: Displayed ranges in API responses use percentage margins, not calibrated confidence intervals. Backtesting could inform better uncertainty quantification.

3. **No Temporal Analysis**: Current implementation doesn't track how accuracy changes over time or by station. Future work could add temporal and spatial analysis.

4. **No Model Comparison**: Script evaluates a single model. Future work could compare multiple models or versions.

## Verification

- All 159 tests pass (144 pre-existing + 15 new).
- Existing API and model code unchanged.
- Read-only evaluation preserves production integrity.
- Matching rules prevent data leakage and seed observation reuse.
- Source handling maintains separation between CPCB and Open-Meteo.
