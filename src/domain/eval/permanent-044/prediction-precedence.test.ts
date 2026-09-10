import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decidePredictionAppend,
  predictionPrecedenceScore,
  ANALYSIS_RUNTIME_VERSION,
} from "@/domain/eval/permanent-044/prediction-precedence";
import type { PermanentPrediction044 } from "@/domain/eval/permanent-044/types";

function pred(partial: Partial<PermanentPrediction044> & Pick<PermanentPrediction044, "prediction_id" | "event_id" | "model_version" | "probability_model">): PermanentPrediction044 {
  return {
    timestamp: "2026-09-10T00:00:00Z",
    feature_version: "features_pi_v1",
    market: "1X2",
    selection: null,
    line: null,
    probability_market: null,
    edge_absolute: null,
    edge_relative: null,
    confidence_score: 50,
    data_quality_score: 0.5,
    recommended: false,
    reason_codes: [],
    risk_flags: [],
    human_readable_reason: "t",
    ranking_bucket: "NO_BET",
    prediction_seq: 1,
    immutable: true,
    ...partial,
  };
}

describe("Phase 3E.1 prediction precedence", () => {
  it("exports analysis runtime version", () => {
    assert.match(ANALYSIS_RUNTIME_VERSION, /phase-3e/);
  });

  it("scores independent above NO_INDEPENDENT", () => {
    const indep = pred({
      prediction_id: "a",
      event_id: "e1",
      model_version: "INDEPENDENT_POISSON_v1",
      probability_model: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      reason_codes: ["INDEPENDENT_MODEL"],
    });
    const none = pred({
      prediction_id: "b",
      event_id: "e1",
      model_version: "MODEL_v1|NO_INDEPENDENT",
      probability_model: null,
      reason_codes: ["NO_INDEPENDENT_MODEL", "FEATURES_TOO_SPARSE"],
    });
    assert.ok(predictionPrecedenceScore(indep) > predictionPrecedenceScore(none));
  });

  it("blocks NO_INDEPENDENT overwrite of independent inference", () => {
    const existing = [
      pred({
        prediction_id: "a",
        event_id: "villa",
        model_version: "INDEPENDENT_POISSON_v1",
        probability_model: { HOME: 0.445, DRAW: 0.274, AWAY: 0.281 },
        reason_codes: ["INDEPENDENT_MODEL", "INDEPENDENT_POISSON_v1"],
        prediction_seq: 2,
        timestamp: "2026-09-10T00:12:00Z",
      }),
    ];
    const candidate = pred({
      prediction_id: "c",
      event_id: "villa",
      model_version: "MODEL_v1|NO_INDEPENDENT",
      probability_model: null,
      reason_codes: ["NO_INDEPENDENT_MODEL", "FEATURES_TOO_SPARSE"],
      prediction_seq: 3,
      timestamp: "2026-09-10T00:14:00Z",
    });
    const d = decidePredictionAppend({ existing, candidate });
    assert.equal(d.action, "block");
    assert.match(d.reason, /BLOCKED_DOWNGRADE/);
  });

  it("allows first NO_INDEPENDENT when no prior independent", () => {
    const candidate = pred({
      prediction_id: "c",
      event_id: "new",
      model_version: "MODEL_v1|NO_INDEPENDENT",
      probability_model: null,
      reason_codes: ["NO_INDEPENDENT_MODEL"],
    });
    const d = decidePredictionAppend({ existing: [], candidate });
    assert.equal(d.action, "allow");
  });

  it("allows independent re-analysis after independent", () => {
    const existing = [
      pred({
        prediction_id: "a",
        event_id: "e1",
        model_version: "INDEPENDENT_POISSON_v1",
        probability_model: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
        reason_codes: ["INDEPENDENT_MODEL"],
      }),
    ];
    const candidate = pred({
      prediction_id: "b",
      event_id: "e1",
      model_version: "INDEPENDENT_POISSON_v1",
      probability_model: { HOME: 0.41, DRAW: 0.29, AWAY: 0.3 },
      reason_codes: ["INDEPENDENT_MODEL"],
      prediction_seq: 2,
      timestamp: "2026-09-10T01:00:00Z",
    });
    const d = decidePredictionAppend({ existing, candidate });
    assert.equal(d.action, "allow");
  });
});