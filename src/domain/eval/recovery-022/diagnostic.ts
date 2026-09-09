/**
 * Diagnostic A–G: measure series existence, granularity, clocks, asOf, first price, horizons.
 * Do not assume 72h/48h/... bins exist — map them from the PHP sampler.
 */

import { SERIES_BINS, SERIES_INTERVAL_MINUTES, seriesColumnRelativeSeconds } from "@/domain/eval/recovery-022/temporal";
import type {
  Diagnostic022,
  HorizonCoverage022,
  HorizonWindow022,
} from "@/domain/eval/recovery-022/types";
import type { SeriesCell } from "@/domain/eval/recovery-022/parse-series";

const HORIZONS: { window: HorizonWindow022; seconds: number }[] = [
  { window: "72h", seconds: 72 * 3600 },
  { window: "48h", seconds: 48 * 3600 },
  { window: "24h", seconds: 24 * 3600 },
  { window: "12h", seconds: 12 * 3600 },
  { window: "6h", seconds: 6 * 3600 },
  { window: "3h", seconds: 3 * 3600 },
  { window: "1h", seconds: 3600 },
  { window: "30m", seconds: 30 * 60 },
  { window: "15m", seconds: 15 * 60 },
  { window: "5m", seconds: 5 * 60 },
];

export function binIndexForRelativeSeconds(seconds: number): number | null {
  if (seconds % (SERIES_INTERVAL_MINUTES * 60) !== 0) return null;
  const hoursBefore = seconds / 3600;
  const bin = SERIES_BINS - 1 - hoursBefore;
  if (bin < 0 || bin >= SERIES_BINS || !Number.isInteger(bin)) return null;
  return bin;
}

export function measureHorizons(cells: readonly SeriesCell[]): HorizonCoverage022[] {
  return HORIZONS.map(({ window, seconds }) => {
    const bin = binIndexForRelativeSeconds(seconds);
    const measured =
      bin == null
        ? 0
        : cells.filter((c) => c.bin === bin && c.odds != null).length;
    return {
      window,
      bin_exists: bin != null,
      bin_index: bin,
      relative_seconds: bin != null ? seriesColumnRelativeSeconds(bin) : null,
      measured_non_nan: measured,
      reconstructable: bin != null && measured > 0,
    };
  });
}

export function firstPriceCells(cells: readonly SeriesCell[]): SeriesCell[] {
  const byKey = new Map<string, SeriesCell>();
  const sorted = [...cells].filter((c) => c.odds != null).sort((a, b) => b.relative_seconds - a.relative_seconds);
  for (const c of sorted) {
    const k = `${c.bookmaker}|${c.selection}`;
    if (!byKey.has(k)) byKey.set(k, c);
  }
  return [...byKey.values()];
}

export function buildSeriesDiagnostic(input: {
  acquiredBulkSeries: boolean;
  cells: readonly SeriesCell[];
}): Diagnostic022 {
  const horizons = measureHorizons(input.cells);
  const hasSeries = input.cells.length > 0;
  const first = firstPriceCells(input.cells);
  return {
    has_time_series: hasSeries || input.acquiredBulkSeries,
    granularity: hasSeries
      ? "hourly (60 min LOCF bins; 72 samples at kickoff-71h … kickoff-0h)"
      : "documented in PHP generator; bulk TXT not acquired",
    timestamp_absolute: false,
    relative_to_kickoff_exact: false,
    can_reconstruct_asof: false,
    can_reconstruct_first_price: first.length > 0,
    timezone: "UNDOCUMENTED",
    horizons,
    php_t_field_bug:
      "generate_closing_odds_csv.php inserts sizeof($diff_win_*) instead of $diff_win_* — t_* in generated SQL stats must not be trusted as seconds",
    markets_in_generator: ["1x2"],
  };
}
