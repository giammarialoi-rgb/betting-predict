import { join } from "node:path";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";
import { computeRankBoards047 } from "@/domain/eval/factory-047/ranking";
import { ensureCatalogDirs055 } from "@/domain/eval/catalog-055/cycle";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type RankBoard055 = {
  date: string;
  TOP_CONFIDENCE: string[];
  TOP_EDGE: string[];
  TOP_ANALYTICAL: string[];
  TOP_LOW_RISK: string[];
  TOP_VALUE: string[];
  TOP_DATA_QUALITY: string[];
  TOP_20_NEXT_24H: { event_id: string; kickoff_utc: string | null; confidence: number }[];
  TOP_20_NEXT_72H: ReturnType<typeof top20Next3Days044>;
  TOP_20_NEXT_7D: { event_id: string; kickoff_utc: string | null; confidence: number }[];
  note: string;
};

function topHorizon(
  store: Store044,
  nowMs: number,
  horizonMs: number,
  limit: number,
): { event_id: string; kickoff_utc: string | null; confidence: number }[] {
  const byPred = new Map<string, (typeof store.predictions)[0]>();
  for (const p of store.predictions) {
    const prev = byPred.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) byPred.set(p.event_id, p);
  }
  const byId = new Map<string, (typeof store.events)[0]>();
  for (const e of store.events) byId.set(e.event_id, e);
  const rows: { event_id: string; kickoff_utc: string | null; confidence: number; t: number }[] = [];
  for (const [id, p] of byPred) {
    const e = byId.get(id);
    if (!e?.kickoff_utc) continue;
    const t = Date.parse(e.kickoff_utc);
    if (!Number.isFinite(t)) continue;
    const d = t - nowMs;
    if (d < -2 * 3600_000 || d > horizonMs) continue;
    rows.push({ event_id: id, kickoff_utc: e.kickoff_utc, confidence: p.confidence_score, t });
  }
  return rows
    .sort((a, b) => b.confidence - a.confidence || a.t - b.t)
    .slice(0, limit)
    .map(({ event_id, kickoff_utc, confidence }) => ({ event_id, kickoff_utc, confidence }));
}

/** Analytical rankings only — never forces bets. */
export function buildRankBoards055(store: Store044, nowIso: string, persist = true): RankBoard055 {
  const base = computeRankBoards047(store, nowIso.slice(0, 10));
  const nowMs = Date.parse(nowIso);
  const byPred = new Map<string, (typeof store.predictions)[0]>();
  for (const p of store.predictions) {
    const prev = byPred.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) byPred.set(p.event_id, p);
  }
  const all = [...byPred.values()].map((p) => ({
    event_id: p.event_id,
    conf: p.confidence_score,
    edge: Math.abs(p.edge_absolute ?? 0),
    dq: p.data_quality_score,
    risk: p.risk_flags.length,
  }));
  const byValue = [...all].sort((a, b) => b.edge * b.conf - a.edge * a.conf).map((x) => x.event_id);
  const byDq = [...all].sort((a, b) => b.dq - a.dq).map((x) => x.event_id);

  const board: RankBoard055 = {
    date: nowIso.slice(0, 10),
    TOP_CONFIDENCE: base.TOP_CONFIDENCE,
    TOP_EDGE: base.TOP_EDGE,
    TOP_ANALYTICAL: base.TOP_ANALYTICAL,
    TOP_LOW_RISK: base.TOP_LOW_RISK,
    TOP_VALUE: byValue.slice(0, 20),
    TOP_DATA_QUALITY: byDq.slice(0, 20),
    TOP_20_NEXT_24H: topHorizon(store, nowMs, 24 * 3600_000, 20),
    TOP_20_NEXT_72H: base.TOP_20_NEXT_72H,
    TOP_20_NEXT_7D: topHorizon(store, nowMs, 7 * 86400_000, 20),
    note: "Informational ranking — PAPER_ONLY — not forced bets",
  };
  if (persist) {
    const root = store.root || permanentRoot044();
    ensureCatalogDirs055(root);
    appendJsonl044(join(root, "catalog-055", "rankings.jsonl"), { kind: "RANK_BOARDS_055", ...board });
  }
  return board;
}
