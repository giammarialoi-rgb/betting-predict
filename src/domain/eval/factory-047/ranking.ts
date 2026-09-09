import { join } from "node:path";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";

export type RankBoard047 = {
  date: string;
  ALL_EVENTS: number;
  TOP_20: string[];
  TOP_10: string[];
  TOP_5: string[];
  TOP_ANALYTICAL: string[];
  TOP_EDGE: string[];
  TOP_CONFIDENCE: string[];
  TOP_LOW_RISK: string[];
  TOP_20_NEXT_72H: ReturnType<typeof top20Next3Days044>;
  note: string;
};

export function computeRankBoards047(store: Store044, date: string): RankBoard047 {
  const byEvent = new Map<string, (typeof store.predictions)[number]>();
  for (const p of store.predictions) {
    const prev = byEvent.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) byEvent.set(p.event_id, p);
  }
  const all = [...byEvent.values()].map((p) => ({
    event_id: p.event_id,
    conf: p.confidence_score,
    edge: Math.abs(p.edge_absolute ?? 0),
    dq: p.data_quality_score,
    risk: p.risk_flags.length,
  }));

  const byConf = [...all].sort((a, b) => b.conf - a.conf).map((x) => x.event_id);
  const byEdge = [...all].sort((a, b) => b.edge - a.edge).map((x) => x.event_id);
  const byDq = [...all].sort((a, b) => b.dq - a.dq).map((x) => x.event_id);
  const byLowRisk = [...all]
    .sort((a, b) => a.risk - b.risk || b.dq - a.dq || b.conf - a.conf)
    .map((x) => x.event_id);

  return {
    date,
    ALL_EVENTS: store.events.length,
    TOP_20: byConf.slice(0, 20),
    TOP_10: byConf.slice(0, 10),
    TOP_5: byConf.slice(0, 5),
    TOP_ANALYTICAL: byDq.slice(0, 20),
    TOP_EDGE: byEdge.slice(0, 20),
    TOP_CONFIDENCE: byConf.slice(0, 20),
    TOP_LOW_RISK: byLowRisk.slice(0, 20),
    TOP_20_NEXT_72H: top20Next3Days044(store),
    note: "Informational ranking — CAPITAL CLOSED — not bets",
  };
}

export function buildRankBoards047(store: Store044, date: string, persist = true): RankBoard047 {
  const board = computeRankBoards047(store, date);
  if (persist) {
    appendJsonl044(join(store.root, "daily-rankings.jsonl"), { kind: "RANK_BOARDS_047", ...board });
  }
  return board;
}
