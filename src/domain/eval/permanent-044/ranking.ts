import { createHash } from "node:crypto";
import { join } from "node:path";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import type { PermanentPrediction044, RankingBucket044 } from "@/domain/eval/permanent-044/types";

export type DailyRanking044 = {
  date: string;
  scope: "soccer" | "tennis" | "global";
  top_n: number;
  buckets: Record<RankingBucket044, string[]>;
  all_event_ids: string[];
  model_version: string;
  fingerprint: string;
};

function latestPredPerEvent(preds: PermanentPrediction044[]): Map<string, PermanentPrediction044> {
  const m = new Map<string, PermanentPrediction044>();
  for (const p of preds) {
    const prev = m.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) m.set(p.event_id, p);
  }
  return m;
}

export function buildDailyRankings044(input: {
  store: Store044;
  date: string;
  modelVersion: string;
  topNs?: number[];
}): DailyRanking044[] {
  const tops = input.topNs ?? [5, 10, 20];
  const latest = latestPredPerEvent(input.store.predictions);
  const bySport = {
    soccer: [...latest.values()].filter((p) => {
      const ev = input.store.events.find((e) => e.event_id === p.event_id);
      return ev?.sport === "soccer";
    }),
    tennis: [...latest.values()].filter((p) => {
      const ev = input.store.events.find((e) => e.event_id === p.event_id);
      return ev?.sport === "tennis";
    }),
    global: [...latest.values()],
  };

  const out: DailyRanking044[] = [];
  for (const scope of ["soccer", "tennis", "global"] as const) {
    const list = bySport[scope];
    const buckets: Record<RankingBucket044, string[]> = {
      TOP_MODEL_MATCHES: [],
      TOP_MARKET_DISLOCATIONS: [],
      TOP_CONFIDENCE: [],
      TOP_VALUE_CANDIDATES: [],
      HIGH_UNCERTAINTY: [],
      NO_BET: [],
    };
    for (const p of list) buckets[p.ranking_bucket].push(p.event_id);

    buckets.TOP_CONFIDENCE = [...list]
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .map((p) => p.event_id);
    buckets.TOP_MARKET_DISLOCATIONS = [...list]
      .sort((a, b) => Math.abs(b.edge_absolute ?? 0) - Math.abs(a.edge_absolute ?? 0))
      .map((p) => p.event_id);
    buckets.NO_BET = list.filter((p) => !p.recommended).map((p) => p.event_id);
    buckets.HIGH_UNCERTAINTY = list
      .filter((p) => p.ranking_bucket === "HIGH_UNCERTAINTY" || p.confidence_score < 40)
      .map((p) => p.event_id);
    buckets.TOP_VALUE_CANDIDATES = [];
    buckets.TOP_MODEL_MATCHES = [...list]
      .sort((a, b) => b.data_quality_score - a.data_quality_score)
      .map((p) => p.event_id);

    for (const top_n of tops) {
      const clipped: Record<RankingBucket044, string[]> = {
        TOP_MODEL_MATCHES: buckets.TOP_MODEL_MATCHES.slice(0, top_n),
        TOP_MARKET_DISLOCATIONS: buckets.TOP_MARKET_DISLOCATIONS.slice(0, top_n),
        TOP_CONFIDENCE: buckets.TOP_CONFIDENCE.slice(0, top_n),
        TOP_VALUE_CANDIDATES: buckets.TOP_VALUE_CANDIDATES.slice(0, top_n),
        HIGH_UNCERTAINTY: buckets.HIGH_UNCERTAINTY.slice(0, top_n),
        NO_BET: buckets.NO_BET.slice(0, top_n),
      };
      const rec: DailyRanking044 = {
        date: input.date,
        scope,
        top_n,
        buckets: clipped,
        all_event_ids: list.map((p) => p.event_id),
        model_version: input.modelVersion,
        fingerprint: createHash("sha256")
          .update(JSON.stringify({ date: input.date, scope, top_n, clipped }))
          .digest("hex")
          .slice(0, 16),
      };
      out.push(rec);
      appendJsonl044(join(input.store.root, "daily-rankings.jsonl"), rec);
    }
  }
  return out;
}
