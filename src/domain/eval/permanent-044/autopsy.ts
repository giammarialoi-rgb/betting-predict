import { createHash } from "node:crypto";
import type { Decision039, Settlement039 } from "@/domain/eval/live-039/types";
import type { PermanentAutopsy044, PermanentPrediction044, LearningCandidate044 } from "@/domain/eval/permanent-044/types";

export function whyDidModelFail044(input: {
  prediction: PermanentPrediction044;
  settlement: Settlement039;
  decision: Decision039 | null;
}): {
  ERROR_TYPE: string | null;
  CAUSE_HYPOTHESES: { hypothesis: string; confidence: number }[];
  EVIDENCE: string[];
  CONFIDENCE: number;
  LEARNING_CANDIDATE: boolean;
  result_class: PermanentAutopsy044["result_class"];
} {
  const out = input.settlement.outcome;
  const evidence: string[] = [
    `settlement_outcome=${out}`,
    `recommended=${input.prediction.recommended}`,
    `model_version=${input.prediction.model_version}`,
    `selection=${input.prediction.selection ?? "none"}`,
  ];

  if (out === "UNSETTLED") {
    return {
      ERROR_TYPE: null,
      CAUSE_HYPOTHESES: [],
      EVIDENCE: evidence,
      CONFIDENCE: 0,
      LEARNING_CANDIDATE: false,
      result_class: "UNRESOLVED",
    };
  }

  if (!input.prediction.recommended) {
    evidence.push("NO_BET_observation — predictive accuracy tracked; no wager error");
    const pick = input.prediction.selection;
    let result_class: PermanentAutopsy044["result_class"] = "NEUTRAL";
    if (pick && input.decision) {
      const map: Record<string, "HOME" | "DRAW" | "AWAY"> = {
        HOME: "HOME",
        DRAW: "DRAW",
        AWAY: "AWAY",
        Home: "HOME",
        Draw: "DRAW",
        Away: "AWAY",
      };
      const norm = map[pick] ?? (pick as "HOME" | "DRAW" | "AWAY");
      if (out === norm || (out === "HOME" && norm === "HOME") || (out === "DRAW" && norm === "DRAW") || (out === "AWAY" && norm === "AWAY")) {
        result_class = "CORRECT";
      } else if (out === "VOID" || out === "PUSH") {
        result_class = "NEUTRAL";
      } else {
        result_class = "INCORRECT";
      }
    }
    const hyps =
      result_class === "INCORRECT"
        ? [
            { hypothesis: "CALIBRATION_ERROR", confidence: 0.35 },
            { hypothesis: "UNKNOWN", confidence: 0.4 },
            { hypothesis: "MARKET_MOVEMENT_ERROR", confidence: 0.25 },
          ]
        : [{ hypothesis: "NO_PRODUCTION_CLAIM", confidence: 0.8 }];
    return {
      ERROR_TYPE: result_class === "INCORRECT" ? "CALIBRATION_ERROR" : null,
      CAUSE_HYPOTHESES: hyps,
      EVIDENCE: evidence,
      CONFIDENCE: result_class === "INCORRECT" ? 0.35 : 0.7,
      LEARNING_CANDIDATE: result_class === "INCORRECT",
      result_class,
    };
  }

  return {
    ERROR_TYPE: "UNKNOWN",
    CAUSE_HYPOTHESES: [{ hypothesis: "UNKNOWN", confidence: 0.2 }],
    EVIDENCE: evidence,
    CONFIDENCE: 0.2,
    LEARNING_CANDIDATE: true,
    result_class: "UNRESOLVED",
  };
}

export function runAutopsy044(input: {
  prediction: PermanentPrediction044;
  settlement: Settlement039;
  decision: Decision039 | null;
}): PermanentAutopsy044 {
  const w = whyDidModelFail044(input);
  return {
    autopsy_id: createHash("sha256")
      .update(`autopsy|${input.prediction.prediction_id}|${input.settlement.settled_at}`)
      .digest("hex")
      .slice(0, 24),
    event_id: input.prediction.event_id,
    prediction_id: input.prediction.prediction_id,
    result_class: w.result_class,
    error_type: w.ERROR_TYPE,
    cause_hypotheses: w.CAUSE_HYPOTHESES,
    evidence: w.EVIDENCE,
    learning_candidate: w.LEARNING_CANDIDATE,
    created_at: new Date().toISOString(),
  };
}

export function learningFromAutopsy044(a: PermanentAutopsy044): LearningCandidate044 | null {
  if (!a.learning_candidate) return null;
  const hyp = a.cause_hypotheses[0]?.hypothesis ?? "UNKNOWN";
  return {
    candidate_id: createHash("sha256").update(`learn|${a.autopsy_id}`).digest("hex").slice(0, 24),
    autopsy_id: a.autopsy_id,
    hypothesis: hyp,
    feature: null,
    observed_pattern: a.evidence.join("; "),
    evidence_count: a.evidence.length,
    confidence: a.cause_hypotheses[0]?.confidence ?? 0.2,
    proposed_change: "Review only — no auto-promotion of MODEL_v1",
    status: "OBSERVED",
  };
}
