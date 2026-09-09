import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildControlCenter046 } from "@/domain/eval/control-046/center";
import { loadCoverageState047 } from "@/domain/eval/factory-047/config";
import { eventHorizons047 } from "@/domain/eval/factory-047/cycle";
import { summarizeMarketsObserved047 } from "@/domain/eval/factory-047/market-catalog";
import { computeRankBoards047 } from "@/domain/eval/factory-047/ranking";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { buildStructuredWhy047 } from "@/domain/eval/factory-047/why";
import { coverageBinsForEvent047 } from "@/domain/eval/factory-047/coverage";
import { catalogMarketsForEvent047 } from "@/domain/eval/factory-047/market-catalog";

/** Extend Control Center with TASK 047 coverage fields. Disk-only. */
export function buildControlCenter047(nowIso = new Date().toISOString()) {
  const base = buildControlCenter046(nowIso);
  const root = permanentRoot044();
  const store = loadStore044(root);
  const cov = loadCoverageState047(root);
  const horizons = eventHorizons047(root, Date.parse(nowIso));
  const markets = summarizeMarketsObserved047(store);
  const ranks = computeRankBoards047(store, nowIso.slice(0, 10));
  const patternsPath = join(root, "manifests", "patterns-047.json");
  const patterns = existsSync(patternsPath)
    ? (JSON.parse(readFileSync(patternsPath, "utf8")) as { patterns?: { pattern: string; sample_size: number; status: string }[] })
        .patterns ?? []
    : [];

  const tennisDiscovery =
    cov.tennis_status === "AVAILABLE"
      ? `TENNIS DISCOVERY: OPEN / ${cov.tennis_keys.length || "keys>0"} AVAILABLE`
      : "TENNIS DISCOVERY: BLOCKED / 0 AVAILABLE";

  return {
    ...base,
    coverage_047: {
      tennis_status: cov.tennis_status,
      tennis_discovery: tennisDiscovery,
      horizons,
      markets_observed: markets.market_keys,
      quote_observations: markets.quote_observations,
      events_with_markets: markets.events_with_markets,
      rankings: {
        TOP_ANALYTICAL: ranks.TOP_ANALYTICAL.slice(0, 10),
        TOP_EDGE: ranks.TOP_EDGE.slice(0, 10),
        TOP_CONFIDENCE: ranks.TOP_CONFIDENCE.slice(0, 10),
        TOP_LOW_RISK: ranks.TOP_LOW_RISK.slice(0, 10),
        TOP_20_NEXT_72H: ranks.TOP_20_NEXT_72H,
      },
      learning_patterns: patterns.slice(0, 20),
      pipeline_counters: {
        DISCOVERED: store.events.filter((e) => e.origin === "DISCOVERED_LIVE").length,
        ANALYZED: new Set(store.predictions.map((p) => p.event_id)).size,
        PREDICTED: store.predictions.length,
        LOCKED: store.locks.length,
        SETTLED: store.settlements.length,
        AUTOPSIED: store.autopsies.length,
        LEARNING_CASES: store.learning.length,
      },
    },
  };
}

export type ControlCenter047 = ReturnType<typeof buildControlCenter047>;

export function enhanceEventDetail047(store: ReturnType<typeof loadStore044>, id: string) {
  const ev = store.events.find((e) => e.event_id === id || e.canonical_event_id === id);
  if (!ev) return null;
  const quotes = store.quotes.filter((q) => q.event_id === ev.event_id);
  const preds = store.predictions
    .filter((p) => p.event_id === ev.event_id)
    .sort((a, b) => a.prediction_seq - b.prediction_seq);
  const latest = preds.at(-1) ?? null;
  const lock = store.locks.find((l) => l.event_id === ev.event_id) ?? null;
  const settlement = store.settlements.find((s) => s.event_id === ev.event_id) ?? null;
  const autopsy = store.autopsies.filter((a) => a.event_id === ev.event_id).at(-1) ?? null;
  const structured_why = latest ? buildStructuredWhy047(latest) : null;
  const bins = coverageBinsForEvent047(ev, quotes);
  const market_catalog = catalogMarketsForEvent047(quotes);
  const timeline = [
    { phase: "DISCOVERY", at: ev.first_seen_at ?? ev.collected_at_utc, done: true },
    { phase: "T-72", at: null, done: bins.T72 },
    { phase: "T-24", at: null, done: bins.T24 },
    { phase: "T-1h", at: null, done: bins.T1H },
    { phase: "LOCK", at: lock?.lock_timestamp ?? null, done: Boolean(lock) },
    { phase: "POST_LOCK", at: null, done: false },
    { phase: "KICKOFF", at: ev.kickoff_utc, done: ev.kickoff_utc ? Date.parse(ev.kickoff_utc) <= Date.now() : false },
    { phase: "RESULT", at: settlement?.settled_at ?? null, done: Boolean(settlement) },
    { phase: "SETTLEMENT", at: settlement?.settled_at ?? null, done: Boolean(settlement) },
    { phase: "AUTOPSY", at: autopsy?.created_at ?? null, done: Boolean(autopsy) },
    { phase: "LEARNING", at: null, done: Boolean(autopsy?.learning_candidate) },
  ];
  return {
    coverage_bins: bins,
    market_catalog,
    structured_why_047: structured_why,
    lifecycle_timeline: timeline,
    comparison: {
      PREDICTION: latest?.selection ?? null,
      ACTUAL: settlement?.result ?? null,
      WHAT_WE_KNEW: structured_why?.FINAL_REASON ?? "NOT_AVAILABLE",
      WHAT_HAPPENED: settlement?.result ?? "NOT_YET",
      WHAT_WE_MISSED: autopsy?.cause_hypotheses[0]?.hypothesis ?? "NOT_AVAILABLE",
    },
  };
}
