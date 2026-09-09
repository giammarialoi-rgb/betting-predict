import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Store044 } from "@/domain/eval/permanent-044/store";
import { summarizeMarketsObserved047 } from "@/domain/eval/factory-047/market-catalog";
import { eventHorizons047 } from "@/domain/eval/factory-047/cycle";
import { loadSportCoverage049 } from "@/domain/eval/factory-049/config";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";

function readDecisions(root: string): DecisionRecord048[] {
  const p = join(root, "decisions.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as DecisionRecord048;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as DecisionRecord048[];
}

export type MassiveLabStats049 = {
  EVENTS_ANALYZED: number;
  EVENTS_TODAY: number;
  EVENTS_NEXT_24H: number;
  EVENTS_NEXT_72H: number;
  EVENTS_NEXT_7D: number;
  SOCCER: number;
  TENNIS: number;
  BASKETBALL: number;
  VOLLEYBALL: number;
  HOCKEY: number;
  OTHER: number;
  MARKETS_OBSERVED: string[];
  MARKETS_ANALYZED: number;
  TOTAL_PREDICTIONS: number;
  NO_BET: number;
  BET_CANDIDATE: number;
  STRONG_CANDIDATE: number;
  LOCKED: number;
  SETTLED: number;
  AUTOPSIED: number;
  LEARNING_CASES: number;
  sport_coverage: ReturnType<typeof loadSportCoverage049>;
  artificial_cap: false;
  catalog_note: string;
};

export function computeMassiveStats049(store: Store044, nowIso = new Date().toISOString()): MassiveLabStats049 {
  const horizons = eventHorizons047(store.root, Date.parse(nowIso));
  const markets = summarizeMarketsObserved047(store);
  const decisions = readDecisions(store.root);
  const latest = new Map<string, DecisionRecord048>();
  for (const d of decisions) {
    const prev = latest.get(d.event_id);
    if (!prev || d.timestamp >= prev.timestamp) latest.set(d.event_id, d);
  }
  const vals = [...latest.values()];
  const bySport = (s: string) => store.events.filter((e) => e.sport === s).length;
  const cov = loadSportCoverage049(store.root);
  const auPath = join(store.root, "autopsies-048.jsonl");
  const auN = existsSync(auPath) ? readFileSync(auPath, "utf8").split(/\n/).filter(Boolean).length : store.autopsies.length;
  const lcPath = join(store.root, "learning-cases.jsonl");
  const lcN = existsSync(lcPath) ? readFileSync(lcPath, "utf8").split(/\n/).filter(Boolean).length : store.learning.length;

  return {
    EVENTS_ANALYZED: new Set(store.predictions.map((p) => p.event_id)).size || store.events.length,
    EVENTS_TODAY: horizons.TODAY,
    EVENTS_NEXT_24H: horizons.NEXT_24H,
    EVENTS_NEXT_72H: horizons.NEXT_72H,
    EVENTS_NEXT_7D: horizons.NEXT_7D,
    SOCCER: bySport("soccer"),
    TENNIS: bySport("tennis"),
    BASKETBALL: bySport("basketball"),
    VOLLEYBALL: bySport("volleyball"),
    HOCKEY: bySport("hockey"),
    OTHER: store.events.filter((e) => !["soccer", "tennis", "basketball", "volleyball", "hockey"].includes(e.sport))
      .length,
    MARKETS_OBSERVED: markets.market_keys,
    MARKETS_ANALYZED: markets.quote_observations,
    TOTAL_PREDICTIONS: store.predictions.length,
    NO_BET: vals.filter((d) => d.decision === "NO_BET").length,
    BET_CANDIDATE: vals.filter((d) => d.decision === "BET_CANDIDATE").length,
    STRONG_CANDIDATE: vals.filter((d) => d.decision === "STRONG_CANDIDATE").length,
    LOCKED: store.locks.length,
    SETTLED: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
    AUTOPSIED: auN,
    LEARNING_CASES: lcN,
    sport_coverage: cov,
    artificial_cap: false,
    catalog_note: "114 LAB A SEED — NOT A CATALOG CAP — no artificial event ceiling",
  };
}

export function writeMassiveStats049(root: string, stats: MassiveLabStats049): void {
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(join(root, "manifests", "massive-lab-stats-049.json"), JSON.stringify(stats, null, 2));
}
