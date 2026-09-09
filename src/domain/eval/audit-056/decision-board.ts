/**
 * Decision board for Control Center — join events + latest decision (disk-only).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import { expectedValue056, fairOdds056, mirrorsMarket056 } from "@/domain/eval/audit-056/math";
import { buildNextEvents046 } from "@/domain/eval/control-046/dashboard";

function piEdgeScientificallyUnknown(root: string): boolean {
  const p = join(root, "predictive-intelligence", "final-verdict.json");
  if (!existsSync(p)) return true; // no PI proof → do not claim known edge
  try {
    const v = JSON.parse(readFileSync(p, "utf8")) as {
      promotion_gate?: { model_edge?: string };
      blockers?: string[];
    };
    if (v.promotion_gate?.model_edge === "UNKNOWN") return true;
    if ((v.blockers ?? []).includes("INDEPENDENT_DOES_NOT_BEAT_BENCHMARKS")) return true;
    if ((v.blockers ?? []).includes("MODEL_EDGE_UNKNOWN")) return true;
  } catch {
    return true;
  }
  return true; // SETTLED>=100 gate not claimed here — keep UNKNOWN
}

export type DecisionBoardRow056 = {
  event_id: string;
  kickoff_utc: string | null;
  sport: string;
  competition: string;
  label: string;
  market: string | null;
  selection: string | null;
  odds: number | null;
  model_pct: number | null;
  market_pct: number | null;
  edge: number | null;
  ev: number | null;
  fair_odds: number | null;
  decision: string;
  stake: number;
  model_version: string | null;
  why: string;
  result: string | null;
  pnl: number | null;
  model_ne_market: boolean;
  edge_status: "KNOWN" | "UNKNOWN" | "LOW";
  status: string;
  minutes_to_kickoff: number | null;
  decision_id: string | null;
  prediction_id: string | null;
};

function latestDecisionByEvent(root: string): Map<string, DecisionRecord048> {
  const p = join(root, "decisions.jsonl");
  const map = new Map<string, DecisionRecord048>();
  if (!existsSync(p)) return map;
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const d = JSON.parse(line.replace(/^\uFEFF/, "")) as DecisionRecord048;
      const prev = map.get(d.event_id);
      if (!prev || d.timestamp >= prev.timestamp) map.set(d.event_id, d);
    } catch {
      /* skip */
    }
  }
  return map;
}

/** Build operational table rows. limit is UI pagination budget, not discovery cap. */
export function buildDecisionBoard056(
  nowIso = new Date().toISOString(),
  limit = 500,
): DecisionBoardRow056[] {
  const root = permanentRoot044();
  const store = loadStore044(root);
  const nowMs = Date.parse(nowIso);
  const events = buildNextEvents046(store, nowMs, limit);
  const decMap = latestDecisionByEvent(root);
  const edgeUnknown = piEdgeScientificallyUnknown(root);

  return events.map((e) => {
    const d = decMap.get(e.event_id) ?? null;
    const modelP = d?.probability ?? d?.fair_probability ?? null;
    const marketP = d?.market_probability ?? null;
    const edge = d?.estimated_edge ?? (modelP != null && marketP != null ? modelP - marketP : null);
    let odds: number | null = null;
    if (marketP != null && marketP > 0) odds = Number((1 / marketP).toFixed(3));
    const ev =
      modelP != null && odds != null ? expectedValue056(modelP, odds) : null;
    const fair = modelP != null ? fairOdds056(modelP) : null;
    const mirrors = mirrorsMarket056(modelP, marketP);
    const why =
      d?.explanation?.WHY_PRIMARY ??
      (mirrors ? "MODEL_MIRRORS_MARKET" : d?.decision_reason_codes?.[0] ?? e.prediction_status);
    let edgeStatus: DecisionBoardRow056["edge_status"] =
      mirrors || edge == null || Math.abs(edge) < 0.02
        ? "UNKNOWN"
        : Math.abs(edge) < 0.03
          ? "LOW"
          : "KNOWN";
    // Until scientific gates pass, never show KNOWN edge in Control Center
    if (edgeUnknown) edgeStatus = "UNKNOWN";

    return {
      event_id: e.event_id,
      kickoff_utc: e.kickoff_utc,
      sport: e.sport,
      competition: e.competition,
      label: e.label,
      market: d?.market ?? e.markets[0] ?? null,
      selection: d?.prediction ?? e.selection,
      odds,
      model_pct: modelP != null ? Number((modelP * 100).toFixed(2)) : null,
      market_pct: marketP != null ? Number((marketP * 100).toFixed(2)) : null,
      edge: edge != null ? Number(edge.toFixed(4)) : null,
      ev: ev != null ? Number(ev.toFixed(4)) : null,
      fair_odds: fair != null ? Number(fair.toFixed(3)) : null,
      decision: d?.decision ?? e.prediction_status,
      stake: d?.decision === "BET_CANDIDATE" || d?.decision === "STRONG_CANDIDATE" ? 0 : 0,
      model_version: d?.model_version ?? null,
      why: (edgeUnknown && !mirrors ? `EDGE_UNKNOWN · ${why}` : why).slice(0, 160),
      result: null,
      pnl: null,
      model_ne_market: !mirrors,
      edge_status: edgeStatus,
      status: e.status,
      minutes_to_kickoff: e.minutes_to_kickoff,
      decision_id: d?.decision_id ?? null,
      prediction_id: d?.prediction_id ?? null,
    };
  });
}

export function sortDecisionBoard056(
  rows: DecisionBoardRow056[],
  sort: "KICKOFF" | "BEST_EDGE" | "BEST_EV" | "CONFIDENCE" = "KICKOFF",
): DecisionBoardRow056[] {
  const copy = [...rows];
  if (sort === "BEST_EDGE") {
    return copy.sort((a, b) => Math.abs(b.edge ?? 0) - Math.abs(a.edge ?? 0));
  }
  if (sort === "BEST_EV") {
    return copy.sort((a, b) => (b.ev ?? -999) - (a.ev ?? -999));
  }
  return copy.sort((a, b) => {
    const ka = a.kickoff_utc ? parseExactUtcMs(a.kickoff_utc) ?? 0 : 0;
    const kb = b.kickoff_utc ? parseExactUtcMs(b.kickoff_utc) ?? 0 : 0;
    return ka - kb;
  });
}
