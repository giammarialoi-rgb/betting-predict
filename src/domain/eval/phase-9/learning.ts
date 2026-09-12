/**
 * Batch learning dataset: prediction → settlement → grading.
 * No per-match weight hacks. Feature importance is not causal.
 */
import { createHash } from "node:crypto";
import { argmax3 } from "@/domain/eval/phase-9/metrics";
import type { Phase9PredRow } from "@/domain/eval/phase-9/types";
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";
import type { LogisticWeightsPi } from "@/domain/eval/predictive-intelligence/models/logistic-challenger";
import type { GbmParams } from "@/domain/eval/predictive-intelligence/models/gbm-stumps";
import type { FeatureDatum } from "@/domain/eval/predictive-intelligence/types";

export type Phase9LearningRow = {
  case_id: string;
  event_id: string;
  model_id: string;
  predicted: string;
  actual: string;
  p_predicted: number;
  p_actual: number;
  error: number;
  hit: boolean;
  auto_applied: false;
};

export function gradeBatch(input: { model_id: string; rows: Phase9PredRow[] }): Phase9LearningRow[] {
  return input.rows.map((r) => {
    const pred = argmax3(r.p);
    return {
      case_id: createHash("sha256").update(`${input.model_id}|${r.canonical_id}`).digest("hex").slice(0, 20),
      event_id: r.canonical_id,
      model_id: input.model_id,
      predicted: pred,
      actual: r.y,
      p_predicted: r.p[pred],
      p_actual: r.p[r.y],
      error: 1 - r.p[r.y],
      hit: pred === r.y,
      auto_applied: false,
    };
  });
}

export function errorAnalysis(rows: Phase9LearningRow[]): {
  n: number;
  hit_rate: number | null;
  mean_error: number | null;
  by_predicted: Record<string, { n: number; hits: number }>;
  hypotheses: { id: string; kind: "IPOTESI"; text: string }[];
} {
  const by_predicted: Record<string, { n: number; hits: number }> = {};
  let err = 0;
  let hits = 0;
  for (const r of rows) {
    by_predicted[r.predicted] ??= { n: 0, hits: 0 };
    by_predicted[r.predicted]!.n += 1;
    if (r.hit) {
      hits += 1;
      by_predicted[r.predicted]!.hits += 1;
    }
    err += r.error;
  }
  const hypotheses: { id: string; kind: "IPOTESI"; text: string }[] = [];
  const draw = by_predicted.DRAW;
  if (draw && draw.n >= 20 && draw.hits / draw.n < 0.2) {
    hypotheses.push({
      id: "H_DRAW_UNDERPREDICTED",
      kind: "IPOTESI",
      text: "Il modello sceglie pochi pari corretti: ipotesi da testare in batch (non auto-feature).",
    });
  }
  const away = by_predicted.AWAY;
  if (away && away.n >= 20 && away.hits / away.n < 0.25) {
    hypotheses.push({
      id: "H_AWAY_CALIBRATION",
      kind: "IPOTESI",
      text: "Le vittorie in trasferta potrebbero essere mal calibrate — da verificare per campionato, non da promuovere a feature.",
    });
  }
  if (!hypotheses.length) {
    hypotheses.push({
      id: "H_NONE_AUTO",
      kind: "IPOTESI",
      text: "Nessuna ipotesi automatica forte; serve analisi umana sul batch.",
    });
  }
  return {
    n: rows.length,
    hit_rate: rows.length ? hits / rows.length : null,
    mean_error: rows.length ? err / rows.length : null,
    by_predicted,
    hypotheses,
  };
}

export function logisticImportance(w: LogisticWeightsPi | null): { key: string; score: number; causal: false }[] {
  if (!w) return [];
  return w.keys
    .map((key, i) => {
      const mag = (w.W[0]?.[i + 1] ?? 0) ** 2 + (w.W[1]?.[i + 1] ?? 0) ** 2 + (w.W[2]?.[i + 1] ?? 0) ** 2;
      return { key, score: mag, causal: false as const };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function gbmImportance(g: GbmParams | null): { key: string; score: number; causal: false }[] {
  if (!g) return [];
  const acc = new Map<string, number>();
  for (const st of g.stumps) {
    const mag = Math.abs(st.logits[0]) + Math.abs(st.logits[1]) + Math.abs(st.logits[2]);
    acc.set(st.feature, (acc.get(st.feature) ?? 0) + mag);
  }
  return [...acc.entries()]
    .map(([key, score]) => ({ key, score, causal: false as const }))
    .sort((a, b) => b.score - a.score);
}

export function featureQualityReport(sample: FeatureDatum[] | null): {
  key: string;
  source: string;
  origin: string | null;
  temporal_precision: string;
  status: string;
  entered_model: boolean | undefined;
  provenance: string;
}[] {
  if (!sample?.length) {
    return [
      {
        key: "none",
        source: "none",
        origin: null,
        temporal_precision: "UNKNOWN",
        status: "UNAVAILABLE",
        entered_model: false,
        provenance: PHASE9_NON_DETERMINABILE,
      },
    ];
  }
  return sample.map((d) => ({
    key: d.key,
    source: d.source,
    origin: d.origin ?? null,
    temporal_precision: d.temporal_precision,
    status: d.status,
    entered_model: d.entered_model,
    provenance: d.calculation ?? d.source,
  }));
}
