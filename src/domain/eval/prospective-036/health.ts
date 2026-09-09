import { emptyCoverage, mergeCoverage, coverageFromSeconds } from "@/domain/eval/prospective-036/windows";
import type { Coverage036, SourceHealth036, Window036 } from "@/domain/eval/prospective-036/types";
import type { ProspectiveQuote036 } from "@/domain/eval/prospective-036/types";
import type { ProspectiveStore036 } from "@/domain/eval/prospective-036/store";

export function coverageFromQuotes(quotes: readonly ProspectiveQuote036[]): Coverage036 {
  let cov = emptyCoverage();
  const byEvent = new Map<string, number[]>();
  for (const q of quotes) {
    if (q.availability_class !== "STRICT" || q.seconds_to_kickoff == null) continue;
    const list = byEvent.get(q.event_id) ?? [];
    list.push(q.seconds_to_kickoff);
    byEvent.set(q.event_id, list);
  }
  for (const secs of byEvent.values()) cov = mergeCoverage(cov, coverageFromSeconds(secs));
  return cov;
}

export function coverageFromStore(store: ProspectiveStore036): Coverage036 {
  return coverageFromQuotes(store.quotes);
}

export function eventWindowFlags036(quotes: readonly ProspectiveQuote036[], eventId: string): Coverage036 {
  return coverageFromQuotes(quotes.filter((q) => q.event_id === eventId));
}

export function coverageAlias036(cov: Coverage036): Record<"coverage_72h" | "coverage_48h" | "coverage_24h" | "coverage_12h" | "coverage_6h" | "coverage_3h" | "coverage_1h" | "coverage_30m" | "coverage_15m" | "coverage_5m" | "coverage_1m", 0 | 1> {
  const map: Record<string, Window036> = {
    coverage_72h: "T-72h",
    coverage_48h: "T-48h",
    coverage_24h: "T-24h",
    coverage_12h: "T-12h",
    coverage_6h: "T-6h",
    coverage_3h: "T-3h",
    coverage_1h: "T-1h",
    coverage_30m: "T-30m",
    coverage_15m: "T-15m",
    coverage_5m: "T-5m",
    coverage_1m: "T-1m",
  };
  return Object.fromEntries(Object.entries(map).map(([k, w]) => [k, cov[w]])) as ReturnType<typeof coverageAlias036>;
}

export function eventCoverageRate(store: ProspectiveStore036, window: "T-72h" | "T-24h" | "T-1h" | "T-5m"): number {
  const events = [...new Set(store.quotes.filter((q) => q.availability_class === "STRICT").map((q) => q.event_id))];
  if (events.length === 0) return 0;
  let hit = 0;
  for (const id of events) {
    if (store.quotes.some((q) => q.event_id === id && q.window === window && q.availability_class === "STRICT")) hit += 1;
  }
  return hit / events.length;
}

export function sourceHealth036(store: ProspectiveStore036, source: string, configured: boolean): SourceHealth036 {
  const qs = store.quotes.filter((q) => q.source === source);
  const ev = store.events.filter((e) => e.source === source);
  const last = store.journal.filter((j) => j.source === source).at(-1);
  const lastOk = [...store.journal].reverse().find((j) => j.source === source && j.status === "ok");
  const lastErr = [...store.journal].reverse().find((j) => j.source === source && j.status !== "ok");
  const latency =
    lastOk?.received_at_utc && lastOk.requested_at_utc
      ? Date.parse(lastOk.received_at_utc) - Date.parse(lastOk.requested_at_utc)
      : null;
  return {
    source,
    status: !configured ? "SOURCE_UNAVAILABLE" : last?.status === "error" ? "error" : last?.status === "SOURCE_UNAVAILABLE" ? "SOURCE_UNAVAILABLE" : configured && lastOk ? "ok" : "SOURCE_UNAVAILABLE",
    last_success: lastOk?.received_at_utc ?? null,
    last_error: lastErr?.error ?? (!configured ? "not configured" : null),
    events_seen: ev.length,
    quotes_seen: qs.length,
    strict_events: new Set(qs.filter((q) => q.availability_class === "STRICT").map((q) => q.event_id)).size,
    last_observation: qs.at(-1)?.quote_observed_at_utc ?? null,
    coverage: coverageFromQuotes(qs),
    latency_ms: latency != null && Number.isFinite(latency) ? latency : null,
    clock_quality: qs.some((q) => q.temporal_basis === "SOURCE_TIMESTAMP") ? "UTC_OFFSET" : configured ? "NONE" : "UNAVAILABLE",
  };
}
