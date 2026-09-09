import { eventCoverageRate039 } from "@/domain/eval/live-039/asof";
import { isStrict039 } from "@/domain/eval/live-039/classify";
import { getOddsApiKey } from "@/domain/eval/live-039/sources";
import type { Store039 } from "@/domain/eval/live-039/store";
import type { CollectionStatus039 } from "@/domain/eval/live-039/types";

export function strictQuotes039(store: Store039) {
  return store.quotes.filter((q) => isStrict039(q.temporal_class, q.match_status));
}

export function strictEvents039(store: Store039): number {
  return new Set(strictQuotes039(store).map((q) => q.event_id)).size;
}

export function matchExactCount039(store: Store039): number {
  return new Set(store.quotes.filter((q) => q.match_status === "MATCH_EXACT").map((q) => q.event_id)).size;
}

export function complete1x2Events039(store: Store039): number {
  const by = new Map<string, Set<string>>();
  for (const q of strictQuotes039(store).filter((q) => q.market === "1X2")) {
    const set = by.get(q.event_id) ?? new Set();
    set.add(q.outcome);
    by.set(q.event_id, set);
  }
  let n = 0;
  for (const sels of by.values()) {
    if (sels.has("HOME") && sels.has("DRAW") && sels.has("AWAY")) n += 1;
  }
  return n;
}

export function settledVerified039(store: Store039): number {
  return store.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
}

export function liveHealth039(store: Store039): {
  source_status: string;
  api_configured: boolean;
  last_poll: string | null;
  events_discovered: number;
  quotes_received: number;
  strict_events: number;
  t1h_coverage: number;
  settled_events: number;
  errors: string[];
  collector_status: CollectionStatus039;
} {
  const configured = Boolean(getOddsApiKey());
  const last = store.journal.at(-1);
  const lastOk = [...store.journal].reverse().find((j) => j.status === "ok");
  const errors = store.journal.filter((j) => j.error).map((j) => j.error!).slice(-8);
  let collector: CollectionStatus039 = "BLOCKED";
  if (lastOk || store.quotes.length > 0 || store.events.length > 0) collector = "COLLECTING";
  else if (!configured) collector = "BLOCKED";
  else if (last?.status === "SOURCE_UNAVAILABLE") collector = "SOURCE_UNAVAILABLE";
  else if (last?.status === "error") collector = "SOURCE_UNAVAILABLE";
  else collector = "READY";
  return {
    source_status: last?.status ?? (store.quotes.length > 0 ? "ok" : configured ? "READY" : "BLOCKED"),
    api_configured: configured,
    last_poll: lastOk?.received_at_utc ?? last?.requested_at_utc ?? null,
    events_discovered: store.events.length,
    quotes_received: store.quotes.length,
    strict_events: strictEvents039(store),
    t1h_coverage: eventCoverageRate039(store.events, store.quotes, "T-1h"),
    settled_events: settledVerified039(store),
    errors,
    collector_status: collector,
  };
}
