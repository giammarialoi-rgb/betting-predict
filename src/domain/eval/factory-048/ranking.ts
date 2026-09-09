import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import type { Store044 } from "@/domain/eval/permanent-044/store";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";

export type RankRow048 = {
  rank: number;
  event_id: string;
  market: string;
  decision: string;
  score: number;
  confidence: number;
  edge: number | null;
  risk: number;
  why: string;
};

function latestDecisions(decisions: DecisionRecord048[]): DecisionRecord048[] {
  const m = new Map<string, DecisionRecord048>();
  for (const d of decisions) {
    const prev = m.get(d.event_id);
    if (!prev || d.timestamp >= prev.timestamp) m.set(d.event_id, d);
  }
  return [...m.values()];
}

function mapRows(
  list: DecisionRecord048[],
  scoreFn: (d: DecisionRecord048) => number,
): RankRow048[] {
  return list
    .map((d) => ({
      rank: 0,
      event_id: d.event_id,
      market: d.market,
      decision: d.decision,
      score: scoreFn(d),
      confidence: d.confidence,
      edge: d.estimated_edge,
      risk: d.risk_score,
      why: d.explanation.WHY_PRIMARY,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function buildRankings048(store: Store044, decisions: DecisionRecord048[]) {
  const latest = latestDecisions(decisions);
  return {
    TOP_CONFIDENCE: mapRows(latest, (d) => d.confidence),
    TOP_EDGE: mapRows(latest, (d) => Math.abs(d.estimated_edge ?? 0) * 100),
    TOP_ANALYTICAL: mapRows(latest, (d) => d.data_quality_score * 100 + d.confidence / 10),
    TOP_LOW_RISK: mapRows(latest, (d) => 100 - d.risk_score),
    TOP_VALUE: mapRows(latest, (d) => Math.abs(d.estimated_edge ?? 0) * d.confidence),
    TOP_WATCHLIST: mapRows(
      latest.filter((d) => d.decision === "BET_CANDIDATE" || d.decision === "STRONG_CANDIDATE"),
      (d) => d.confidence + Math.abs(d.estimated_edge ?? 0) * 100,
    ),
    TOP_20_NEXT_72H: top20Next3Days044(store).map((r) => {
      const d = latest.find((x) => x.event_id === r.event_id);
      return {
        ...r,
        decision: d?.decision ?? "NO_BET",
        risk: d?.risk_score ?? null,
        why: d?.explanation.WHY_PRIMARY ?? r.main_reason,
      };
    }),
    note: "confidence ≠ edge — informational rankings; CAPITAL CLOSED",
  };
}
