import { isAggregateOddsLabel } from "@/domain/markets/canonical";
import type { MarketObservationLedger } from "@/domain/eval/capital-021/types";

export function assertIndividualBookmaker(bookmaker: string): void {
  if (isAggregateOddsLabel(bookmaker) || /^(max|avg|median|consensus)$/i.test(bookmaker)) {
    throw new Error(`AGGREGATE_NOT_BOOKMAKER: ${bookmaker}`);
  }
}

export function ledgerIdentity(row: MarketObservationLedger): string {
  return [
    row.sport,
    row.event,
    row.market,
    row.line ?? "",
    row.selection,
    row.bookmaker,
    row.observed_at,
    row.price.toFixed(4),
    row.source,
  ].join("|");
}

export function dedupeLedger(
  rows: readonly MarketObservationLedger[],
): MarketObservationLedger[] {
  const seen = new Set<string>();
  const out: MarketObservationLedger[] = [];
  for (const row of rows) {
    assertIndividualBookmaker(row.bookmaker);
    const k = ledgerIdentity(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

export function countByPrecision(rows: readonly MarketObservationLedger[]): {
  exact: number;
  date_only: number;
  dataset_window: number;
  unknown: number;
  strict_usable: number;
} {
  return {
    exact: rows.filter((r) => r.temporal_precision === "EXACT_TIMESTAMP").length,
    date_only: rows.filter((r) => r.temporal_precision === "DATE_ONLY").length,
    dataset_window: rows.filter((r) => r.temporal_precision === "DATASET_WINDOW").length,
    unknown: rows.filter((r) => r.temporal_precision === "UNKNOWN").length,
    strict_usable: rows.filter((r) => r.usable_strict_capital).length,
  };
}
