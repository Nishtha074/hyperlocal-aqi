"""Standalone forecast backtesting script.

Matches persisted forecasts against later observations and computes MAE/RMSE
separately by horizon and observation source. Read-only evaluation; does not
write to model_metrics or modify production tables.

Usage:
    python scripts/backtest_forecasts.py [--tolerance-minutes 30] [--source all|Open-Meteo|CPCB] [--output-csv results.csv]

Matching rules:
  1. predicted_at identifies the target observation time (NOT observation_timestamp).
  2. Matched observation must be at or after forecast's generated_at (no data leakage).
  3. Never use the seed observation (observation_timestamp) as the forecast outcome.
  4. If multiple observations qualify, choose the closest valid observation to predicted_at.
  5. Avoid counting the same prediction more than once.
  6. Configurable timestamp tolerance (default ±30 minutes).

Source handling:
  - CPCB: Physical monitoring station readings (source='CPCB', or legacy rows with source IS NULL
    where station does not carry the LIVE_ synthetic prefix).
  - Open-Meteo: Modeled regional estimates (source='Open-Meteo', or rows with station starting with LIVE_).
  - Missing/NULL source values are resolved carefully by station identity rather than assuming every row is CPCB.
  - Metrics are computed and reported separately per source; never merged into a combined accuracy score.
"""

import asyncio
import csv
import logging
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("backtest_forecasts")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

DB_URL = os.getenv("DATABASE_URL")
DEFAULT_HORIZONS = ("1h", "3h", "6h")


@dataclass
class MatchedPair:
    """A forecast-observation pair used for accuracy computation."""
    station: str
    horizon: str
    source: str
    forecast_value: float
    observation_value: float
    predicted_at: datetime
    observation_fetched_at: datetime
    generated_at: datetime
    observation_timestamp: Optional[str]


@dataclass
class MetricsResult:
    """Accuracy metrics for a horizon and source combination."""
    horizon: str
    source: str
    count: int
    mae: Optional[float]
    rmse: Optional[float]

    @property
    def has_sufficient_data(self) -> bool:
        """True if at least one valid pair was evaluated."""
        return self.count > 0 and self.mae is not None and self.rmse is not None



def _to_datetime(val: Any) -> Optional[datetime]:
    """Parse datetimes and normalize them to naive UTC."""
    if val is None:
        return None

    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None

    try:
        if isinstance(val, datetime):
            dt = val
        elif isinstance(val, str):
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        else:
            return None

        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

        # Naive timestamps are assumed to already be UTC.
        return dt

    except (ValueError, TypeError, OverflowError):
        return None



def resolve_observation_source(obs: dict) -> str:
    """Identify the observation source.

    Rule:
      - If source is explicitly set, normalize and return it.
      - If source is NULL or empty:
          * If station starts with 'LIVE_', it is an Open-Meteo synthetic city estimate.
          * If station does not start with 'LIVE_' and is non-empty, it is a physical CPCB/MPCB station.
          * If station is empty or None, return 'Unknown'.
    This avoids incorrectly assuming every legacy/NULL row is CPCB.
    """
    raw_source = obs.get("source")
    if raw_source:
        s = str(raw_source).strip()
        if s.casefold() in ("open-meteo", "openmeteo"):
            return "Open-Meteo"
        if s.casefold() == "cpcb":
            return "CPCB"
        return s

    station = str(obs.get("station") or "").strip()
    if station.startswith("LIVE_"):
        return "Open-Meteo"
    if station:
        return "CPCB"
    return "Unknown"


def _is_seed_observation(obs_last_update: Any, seed_obs_ts: Any) -> bool:
    """Check if an observation matches the forecast's seed observation timestamp."""
    if not seed_obs_ts or not obs_last_update:
        return False
    str_obs = str(obs_last_update).strip()
    str_seed = str(seed_obs_ts).strip()
    if str_obs == str_seed:
        return True
    dt_obs = _to_datetime(str_obs)
    dt_seed = _to_datetime(str_seed)
    if dt_obs is not None and dt_seed is not None and dt_obs == dt_seed:
        return True
    return False


def _normalize_source_filter(source_filter: str) -> str:
    """Normalize user input for source filter."""
    sf = (source_filter or "all").strip().casefold()
    if sf in ("all", "all recognized sources"):
        return "all"
    if sf in ("open-meteo", "openmeteo"):
        return "Open-Meteo"
    if sf == "cpcb":
        return "CPCB"
    return source_filter.strip()



def _match_forecasts_to_observations(
    forecasts: list[dict],
    observations: list[dict],
    tolerance_minutes: int = 30,
    source_filter: str = "all",
) -> list[MatchedPair]:
    """Match forecasts to observations using the actual observation time."""
    matched_pairs: list[MatchedPair] = []
    tolerance_seconds = float(tolerance_minutes * 60)
    norm_filter = _normalize_source_filter(source_filter)

    obs_by_station: dict[str, list[dict]] = {}
    for obs in observations:
        station = obs.get("station")
        if station:
            obs_by_station.setdefault(station, []).append(obs)

    # Prevent duplicate evaluation of the same prediction.
    evaluated_predictions: set[tuple] = set()

    for forecast in forecasts:
        station = forecast.get("station")
        if not station or station not in obs_by_station:
            continue

        predicted_at = _to_datetime(forecast.get("predicted_at"))
        generated_at = _to_datetime(forecast.get("generated_at"))

        if predicted_at is None or generated_at is None:
            continue

        horizon = str(forecast.get("horizon") or "")
        if horizon not in DEFAULT_HORIZONS:
            continue

        try:
            forecast_value = float(forecast["predicted_pm25"])
        except (KeyError, TypeError, ValueError):
            continue

        seed_obs_ts = forecast.get("observation_timestamp")
        prediction_key = (station, horizon, generated_at, predicted_at)

        if prediction_key in evaluated_predictions:
            continue
        evaluated_predictions.add(prediction_key)

        best_match = None
        best_distance = None
        best_source = None
        best_observation_time = None

        for obs in obs_by_station[station]:
            if obs.get("pm25") is None:
                continue

            obs_source = resolve_observation_source(obs)
            if (
                norm_filter != "all"
                and obs_source.casefold() != norm_filter.casefold()
            ):
                continue

            # Open-Meteo last_update is the actual hourly observation time.
            # CPCB keeps the existing fetched_at matching behavior for now.
            if obs_source == "Open-Meteo":
                observation_time = _to_datetime(obs.get("last_update"))
            else:
                observation_time = _to_datetime(obs.get("fetched_at"))

            if observation_time is None:
                continue

            # The observation must not predate forecast generation.
            if observation_time < generated_at:
                continue

            # Never evaluate a forecast against its seed observation.
            if _is_seed_observation(obs.get("last_update"), seed_obs_ts):
                continue

            distance = abs(
                (observation_time - predicted_at).total_seconds()
            )
            if distance > tolerance_seconds:
                continue

            if best_distance is None or distance < best_distance:
                best_match = obs
                best_distance = distance
                best_source = obs_source
                best_observation_time = observation_time

        if (
            best_match is not None
            and best_source is not None
            and best_observation_time is not None
        ):
            matched_pairs.append(
                MatchedPair(
                    station=station,
                    horizon=horizon,
                    source=best_source,
                    forecast_value=forecast_value,
                    observation_value=float(best_match["pm25"]),
                    predicted_at=predicted_at,
                    observation_fetched_at=best_observation_time,
                    generated_at=generated_at,
                    observation_timestamp=(
                        str(seed_obs_ts)
                        if seed_obs_ts is not None
                        else None
                    ),
                )
            )

    return matched_pairs



def _compute_metrics(
    matched_pairs: list[MatchedPair],
    horizons: tuple[str, ...] = DEFAULT_HORIZONS,
    sources: Optional[list[str]] = None,
) -> list[MetricsResult]:
    """Compute MAE and RMSE separately for each (horizon, source) combination.

    - Returns count=0, mae=None, rmse=None when no valid pairs exist.
    - Never invents metrics or reports zero error when count is zero.
    - Never merges different observation sources into a single metric.
    """
    if not matched_pairs and not sources:
        return []

    # Group pairs by (horizon, source)
    groups: dict[tuple[str, str], list[MatchedPair]] = {}
    present_sources = set()
    present_horizons = set()
    for pair in matched_pairs:
        key = (pair.horizon, pair.source)
        groups.setdefault(key, []).append(pair)
        present_sources.add(pair.source)
        present_horizons.add(pair.horizon)

    target_sources = sorted(set(sources) if sources else present_sources)
    target_horizons = list(horizons)
    for h in sorted(present_horizons):
        if h not in target_horizons:
            target_horizons.append(h)

    results: list[MetricsResult] = []
    for source in target_sources:
        for horizon in target_horizons:
            pairs = groups.get((horizon, source), [])
            if not pairs:
                results.append(
                    MetricsResult(
                        horizon=horizon,
                        source=source,
                        count=0,
                        mae=None,
                        rmse=None,
                    )
                )
            else:
                errors = [abs(p.forecast_value - p.observation_value) for p in pairs]
                squared_errors = [e ** 2 for e in errors]
                mae = sum(errors) / len(errors)
                rmse = (sum(squared_errors) / len(squared_errors)) ** 0.5
                results.append(
                    MetricsResult(
                        horizon=horizon,
                        source=source,
                        count=len(pairs),
                        mae=mae,
                        rmse=rmse,
                    )
                )

    return results


def _print_summary(metrics: list[MetricsResult], matched_pairs: list[MatchedPair]) -> None:
    """Print a readable summary of backtesting results."""
    print("\n" + "=" * 80)
    print("FORECAST BACKTESTING RESULTS")
    print("=" * 80)

    total_pairs = len(matched_pairs)
    if total_pairs == 0:
        print("\nNo matched forecast-observation pairs found (insufficient data).")
        print("Possible reasons:")
        print("  - No forecasts with predicted_at in the database.")
        print("  - No observations within the tolerance window.")
        print("  - All candidate observations are before forecast generation time.")
        print("  - All candidate observations match the seed observation_timestamp.")
        print("\n" + "=" * 80)
        return

    print(f"\nTotal matched pairs: {total_pairs}")
    print("\nMetrics by horizon and source (independent evaluation; never combined):")
    print("-" * 80)
    print(f"{'Horizon':<10} {'Source':<15} {'Count':<8} {'MAE':<15} {'RMSE':<15}")
    print("-" * 80)

    for result in metrics:
        if not result.has_sufficient_data:
            print(f"{result.horizon:<10} {result.source:<15} {result.count:<8} {'Insufficient data':<15} {'Insufficient data':<15}")
        else:
            mae_str = f"{result.mae:.2f} µg/m³"
            rmse_str = f"{result.rmse:.2f} µg/m³"
            print(f"{result.horizon:<10} {result.source:<15} {result.count:<8} {mae_str:<15} {rmse_str:<15}")

    print("-" * 80)

    # Summary breakdown by source
    print("\nSummary by source:")
    sources = sorted(set(p.source for p in matched_pairs))
    for src in sources:
        src_pairs = [p for p in matched_pairs if p.source == src]
        print(f"  {src}: {len(src_pairs)} matched pairs")

    print("\n" + "=" * 80)

    print("\n" + "=" * 100)
    print("INDIVIDUAL MATCHED FORECASTS")
    print("=" * 100)

    for pair in sorted(
        matched_pairs,
        key=lambda p: (p.station, p.predicted_at, p.horizon),
    ):
        print(
            f"Station={pair.station} | "
            f"Horizon={pair.horizon} | "
            f"Generated={pair.generated_at} | "
            f"Target={pair.predicted_at} | "
            f"Observation={pair.observation_fetched_at} | "
            f"Predicted PM2.5={pair.forecast_value:.2f} | "
            f"Observed PM2.5={pair.observation_value:.2f}"
        )


def _write_csv(filepath: str, matched_pairs: list[MatchedPair]) -> None:
    """Write matched pairs to CSV for further analysis."""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "station",
                "horizon",
                "source",
                "forecast_value",
                "observation_value",
                "error",
                "predicted_at",
                "observation_fetched_at",
                "generated_at",
                "observation_timestamp",
            ],
        )
        writer.writeheader()
        for pair in matched_pairs:
            writer.writerow({
                "station": pair.station,
                "horizon": pair.horizon,
                "source": pair.source,
                "forecast_value": pair.forecast_value,
                "observation_value": pair.observation_value,
                "error": round(pair.forecast_value - pair.observation_value, 4),
                "predicted_at": pair.predicted_at.isoformat() if pair.predicted_at else None,
                "observation_fetched_at": pair.observation_fetched_at.isoformat() if pair.observation_fetched_at else None,
                "generated_at": pair.generated_at.isoformat() if pair.generated_at else None,
                "observation_timestamp": pair.observation_timestamp,
            })


async def backtest_forecasts(
    tolerance_minutes: int = 30,
    source_filter: str = "all",
    output_csv: Optional[str] = None,
) -> list[MetricsResult]:
    """Match forecasts to observations and compute MAE/RMSE by horizon and source.

    Args:
        tolerance_minutes: Maximum time difference (±) between predicted_at and
                          observation fetched_at to consider a match valid.
        source_filter: "all", "Open-Meteo", or "CPCB" to filter results.
        output_csv: Optional path to write matched pairs to CSV.

    Returns:
        List of MetricsResult objects, one per (horizon, source) combination.
    """
    if not DB_URL:
        logger.error("DATABASE_URL is not set")
        raise RuntimeError("DATABASE_URL is not configured")

    conn = None
    try:
        conn = await asyncpg.connect(DB_URL)
        logger.info("Connected to database. Fetching forecasts and observations...")

        forecasts = await conn.fetch("""
            SELECT
                id,
                station,
                horizon,
                predicted_pm25,
                generated_at,
                predicted_at,
                observation_timestamp
            FROM forecasts
            WHERE predicted_at IS NOT NULL
              AND predicted_pm25 IS NOT NULL
              AND generated_at IS NOT NULL
            ORDER BY station, horizon, predicted_at
        """)
        logger.info("Found %d forecasts with predicted_at.", len(forecasts))

        observations = await conn.fetch("""
            SELECT
                station,
                pm25,
                fetched_at,
                source,
                last_update
            FROM cpcb_readings
            WHERE pm25 IS NOT NULL
              AND fetched_at IS NOT NULL
            ORDER BY station, fetched_at
        """)
        logger.info("Found %d observations.", len(observations))

        forecast_dicts = [dict(r) for r in forecasts]
        obs_dicts = [dict(r) for r in observations]

        matched_pairs = _match_forecasts_to_observations(
            forecast_dicts, obs_dicts, tolerance_minutes, source_filter
        )
        logger.info("Matched %d forecast-observation pairs.", len(matched_pairs))

        norm_filter = _normalize_source_filter(source_filter)
        if norm_filter == "all":
            selected_sources = ["CPCB", "Open-Meteo"]
        else:
            selected_sources = [norm_filter]

        metrics = _compute_metrics(
            matched_pairs,
            horizons=DEFAULT_HORIZONS,
            sources=selected_sources if not matched_pairs else None,
        )

        _print_summary(metrics, matched_pairs)

        if output_csv:
            _write_csv(output_csv, matched_pairs)
            logger.info("Matched pairs written to %s", output_csv)

        return metrics

    except Exception as exc:
        logger.error("Backtesting failed (%s): %s", type(exc).__name__, exc)
        raise
    finally:
        if conn is not None:
            await conn.close()


async def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Backtest persisted forecasts against observations."
    )
    parser.add_argument(
        "--tolerance-minutes",
        type=int,
        default=30,
        help="Tolerance window in minutes (default: 30)",
    )
    parser.add_argument(
        "--source",
        choices=["all", "Open-Meteo", "CPCB"],
        default="all",
        help="Filter by observation source (default: all)",
    )
    parser.add_argument(
        "--output-csv",
        type=str,
        default=None,
        help="Optional path to write matched pairs to CSV",
    )

    args = parser.parse_args()

    try:
        await backtest_forecasts(
            tolerance_minutes=args.tolerance_minutes,
            source_filter=args.source,
            output_csv=args.output_csv,
        )
        sys.exit(0)
    except Exception as exc:
        logger.error("Backtesting failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
