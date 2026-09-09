import type { FirstAvailable023, PriceTick023 } from "@/domain/eval/temporal-023/types";

function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - pos) + sorted[hi]! * (pos - lo);
}

export function firstAvailableStats(input: {
  eventId: string;
  marketId: string;
  ticks: readonly PriceTick023[];
}): FirstAvailable023 {
  const pts = [
    ...new Set(
      input.ticks.filter((t) => t.phase === "PREMATCH").map((t) => t.publishTimeMs),
    ),
  ].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    intervals.push((pts[i]! - pts[i - 1]!) / 1000);
  }
  intervals.sort((a, b) => a - b);
  return {
    eventId: input.eventId,
    marketId: input.marketId,
    first_observation_timestamp: pts[0] != null ? new Date(pts[0]).toISOString() : null,
    last_prematch_timestamp:
      pts.length > 0 ? new Date(pts[pts.length - 1]!).toISOString() : null,
    prematch_observation_count: pts.length,
    median_observation_interval: quantile(intervals, 0.5),
    p95_observation_interval: quantile(intervals, 0.95),
    minimum_observation_interval: intervals[0] ?? null,
    maximum_observation_interval: intervals.at(-1) ?? null,
  };
}
