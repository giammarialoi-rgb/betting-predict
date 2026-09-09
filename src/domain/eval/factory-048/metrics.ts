import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import type { Autopsy048 } from "@/domain/eval/factory-048/autopsy";
import type { Store044 } from "@/domain/eval/permanent-044/store";

export type DecisionMetrics048 = {
  TOTAL_ANALYZED: number;
  TOTAL_PREDICTIONS: number;
  NO_BET: number;
  BET_CANDIDATE: number;
  STRONG_CANDIDATE: number;
  SETTLED: number;
  CORRECT: number;
  WRONG: number;
  accuracy: number | null;
  Brier: null;
  LogLoss: null;
  calibration: null;
  mean_confidence: number | null;
  mean_edge: number | null;
  edge_distribution: { below_0: number; mid: number; above_003: number };
  why_performance: { reason: string; n: number; correct: number }[];
  MODEL_EDGE: "UNKNOWN";
  MARKET_BRIER: null;
  MODEL_BRIER: null;
  DELTA_BRIER: null;
  CI_95: null;
  HOLM: null;
  HOLDOUT: null;
  note: string;
};

export function computeMetrics048(input: {
  store: Store044;
  decisions: DecisionRecord048[];
  autopsies: Autopsy048[];
}): DecisionMetrics048 {
  const latest = new Map<string, DecisionRecord048>();
  for (const d of input.decisions) {
    const prev = latest.get(d.event_id);
    if (!prev || d.timestamp >= prev.timestamp) latest.set(d.event_id, d);
  }
  const vals = [...latest.values()];
  const settled = input.store.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  const correct = input.autopsies.filter((a) => a.prediction_correct === true).length;
  const wrong = input.autopsies.filter((a) => a.prediction_correct === false).length;
  const nOut = correct + wrong;

  const whyMap = new Map<string, { n: number; correct: number }>();
  for (const a of input.autopsies) {
    const d = input.decisions.find((x) => x.prediction_id === a.prediction_id);
    for (const code of d?.decision_reason_codes ?? ["UNKNOWN"]) {
      const prev = whyMap.get(code) ?? { n: 0, correct: 0 };
      prev.n += 1;
      if (a.prediction_correct === true) prev.correct += 1;
      whyMap.set(code, prev);
    }
  }

  const edges = vals.map((d) => d.estimated_edge).filter((e): e is number => e != null);
  const confs = vals.map((d) => d.confidence);

  return {
    TOTAL_ANALYZED: latest.size,
    TOTAL_PREDICTIONS: input.store.predictions.length,
    NO_BET: vals.filter((d) => d.decision === "NO_BET").length,
    BET_CANDIDATE: vals.filter((d) => d.decision === "BET_CANDIDATE").length,
    STRONG_CANDIDATE: vals.filter((d) => d.decision === "STRONG_CANDIDATE").length,
    SETTLED: settled,
    CORRECT: correct,
    WRONG: wrong,
    accuracy: nOut >= 20 ? correct / nOut : null,
    Brier: null,
    LogLoss: null,
    calibration: null,
    mean_confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
    mean_edge: edges.length ? edges.reduce((a, b) => a + b, 0) / edges.length : null,
    edge_distribution: {
      below_0: edges.filter((e) => e < 0).length,
      mid: edges.filter((e) => e >= 0 && e < 0.03).length,
      above_003: edges.filter((e) => e >= 0.03).length,
    },
    why_performance: [...whyMap.entries()]
      .map(([reason, v]) => ({ reason, n: v.n, correct: v.correct }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 20),
    MODEL_EDGE: "UNKNOWN",
    MARKET_BRIER: null,
    MODEL_BRIER: null,
    DELTA_BRIER: null,
    CI_95: null,
    HOLM: null,
    HOLDOUT: null,
    note:
      settled < 100
        ? "SETTLED < 100 — no definitive statistical edge metrics"
        : "Settled sample growing — still no auto edge claim without gates",
  };
}

export function writeDecisionMetrics048(root: string, metrics: DecisionMetrics048): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "decision-metrics.json"), JSON.stringify(metrics, null, 2));
}
