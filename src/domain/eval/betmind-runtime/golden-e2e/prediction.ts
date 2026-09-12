/**
 * Gates then PREDICTION or honest NO PREDICTION. Never bypass. Never invent probs.
 */
import { createHash } from "node:crypto";
import { predictIndependentForEvent } from "@/domain/eval/predictive-intelligence/predict-live";
import { hasIndependentModel } from "@/domain/eval/permanent-044/prediction-precedence";
import type { AnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { GateResult, PredictionOutcome } from "@/domain/eval/betmind-runtime/golden-e2e/types";

export function runPredictionGates(input: {
  event: PermanentEvent044;
  dossier: AnalysisDossier | null;
  predictOk: boolean;
  probability: Record<string, number> | null;
  modelVersion: string;
  reasonCodes: string[];
  featureCoverage: number | null;
}): { gates: GateResult[]; allowed: boolean } {
  const gates: GateResult[] = [
    {
      name: "event_identity",
      passed: Boolean(input.event.event_id && input.event.home_or_a && input.event.away_or_b),
      reason: "home/away/event_id required",
    },
    {
      name: "dossier_present",
      passed: Boolean(input.dossier),
      reason: input.dossier ? "analysis_dossier built" : "no analysis_dossier",
    },
    {
      name: "independent_model",
      passed: hasIndependentModel({
        probability_model: input.probability,
        model_version: input.modelVersion,
        reason_codes: input.reasonCodes,
      }),
      reason: "INDEPENDENT model + probability required; no naked probability",
    },
    {
      name: "predict_ok",
      passed: input.predictOk && input.probability != null,
      reason: input.predictOk ? "predictIndependentForEvent ok" : "predictIndependentForEvent failed",
    },
    {
      name: "feature_coverage",
      passed: input.featureCoverage != null && input.featureCoverage >= 0.35,
      reason:
        input.featureCoverage == null
          ? "feature_coverage unavailable"
          : `feature_coverage=${input.featureCoverage}`,
    },
    {
      name: "no_failed_research_as_model",
      passed: !(input.reasonCodes.includes("INSUFFICIENT_DATA") && !input.predictOk),
      reason: "INSUFFICIENT_DATA cannot become a prediction",
    },
  ];
  return { gates, allowed: gates.every((g) => g.passed) };
}

export function decidePrediction(input: {
  event: PermanentEvent044;
  dossier: AnalysisDossier | null;
  labBRoot?: string;
  decisionTime?: string | null;
}): PredictionOutcome {
  const pred = predictIndependentForEvent({
    sport: input.event.sport,
    home_team: input.event.home_or_a,
    away_team: input.event.away_or_b,
    competition: input.event.competition,
    kickoff_utc: input.event.kickoff_utc,
    labBRoot: input.labBRoot,
    decisionTime: input.decisionTime ?? input.event.kickoff_utc,
  });

  const { gates, allowed } = runPredictionGates({
    event: input.event,
    dossier: input.dossier,
    predictOk: pred.ok,
    probability: pred.probability_model,
    modelVersion: pred.model_version,
    reasonCodes: pred.reason_codes,
    featureCoverage: pred.feature_coverage,
  });

  const dossierVersion =
    input.dossier?.cycle.model_version ?? input.dossier?.prediction_id ?? input.dossier?.analyzed_at ?? null;

  if (!allowed || !pred.probability_model) {
    return {
      kind: "NO_PREDICTION",
      event_id: input.event.event_id,
      reason: "failed_gates",
      missing: gates.filter((g) => !g.passed).map((g) => g.name),
      failed_gates: gates.filter((g) => !g.passed).map((g) => g.name),
      gate_results: gates,
      dossier_version: dossierVersion,
    };
  }

  const p = pred.probability_model;
  const fair =
    typeof p.HOME === "number" && typeof p.DRAW === "number" && typeof p.AWAY === "number"
      ? {
          HOME: p.HOME > 0 ? 1 / p.HOME : null,
          DRAW: p.DRAW > 0 ? 1 / p.DRAW : null,
          AWAY: p.AWAY > 0 ? 1 / p.AWAY : null,
        }
      : null;
  const fairOdds = fair && fair.HOME && fair.DRAW && fair.AWAY
    ? { HOME: fair.HOME, DRAW: fair.DRAW, AWAY: fair.AWAY }
    : null;

  const ranked = (["HOME", "DRAW", "AWAY"] as const)
    .map((k) => ({ k, v: p[k] ?? 0 }))
    .sort((a, b) => b.v - a.v)[0];

  const prediction_id = createHash("sha256")
    .update(`golden|${input.event.event_id}|${pred.model_version}|${input.event.kickoff_utc ?? ""}`)
    .digest("hex")
    .slice(0, 24);

  return {
    kind: "PREDICTION",
    prediction_id,
    event_id: input.event.event_id,
    model_version: pred.model_version,
    market: "1X2",
    selection: ranked?.k ?? null,
    probs: p,
    fair_odds: fairOdds,
    available_odds: null,
    edge: null,
    confidence: pred.model_confidence,
    gate_results: gates,
    evidence_refs: pred.reason_codes,
    dossier_version: dossierVersion,
  };
}
