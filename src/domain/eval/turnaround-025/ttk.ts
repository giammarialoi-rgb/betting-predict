import { AS_OF_WINDOWS, type AsOfWindowId } from "@/domain/eval/temporal-023/types";
import type { WindowSnapshot023 } from "@/domain/eval/temporal-023/types";

export const TTK_LABEL: Record<AsOfWindowId, string> = {
  "72h": "T-72h",
  "48h": "T-48h",
  "24h": "T-24h",
  "12h": "T-12h",
  "6h": "T-6h",
  "3h": "T-3h",
  "1h": "T-1h",
  "30m": "T-30m",
  "15m": "T-15m",
  "5m": "T-5m",
  "1m": "T-1m",
};

export type TtkRow025 = {
  bucket: string;
  observed: boolean;
  price: number | null;
  timestamp: string | null;
  seconds_before_kickoff: number | null;
};

export function ttkFromWindows(windows: readonly WindowSnapshot023[]): TtkRow025[] {
  return AS_OF_WINDOWS.map((w) => {
    const row = windows.find((x) => x.window === w.window);
    return {
      bucket: TTK_LABEL[w.window],
      observed: row?.snapshot_exists === true && row.price_available === true,
      price: null,
      timestamp: row?.actual_timestamp ?? null,
      seconds_before_kickoff: row?.seconds_before_kickoff ?? null,
    };
  });
}

export function movementFromObserved(rows: readonly TtkRow025[]): {
  direction: "up" | "down" | "flat" | "not_observed";
  magnitude: number | null;
  n_observed: number;
} {
  const obs = rows.filter((r) => r.observed && r.price != null && r.price > 1);
  if (obs.length < 2) {
    return { direction: "not_observed", magnitude: null, n_observed: obs.length };
  }
  const first = obs[0]!.price!;
  const last = obs[obs.length - 1]!.price!;
  const mag = last - first;
  return {
    direction: mag > 1e-9 ? "up" : mag < -1e-9 ? "down" : "flat",
    magnitude: mag,
    n_observed: obs.length,
  };
}

export function attachPrices(
  rows: readonly TtkRow025[],
  priceByTimestamp: ReadonlyMap<string, number>,
): TtkRow025[] {
  return rows.map((r) => ({
    ...r,
    price: r.timestamp ? (priceByTimestamp.get(r.timestamp) ?? null) : null,
  }));
}
