/**
 * Future independent model contract — types/helpers only (no MODEL_v3).
 */

import type { IndependentModelContract057 } from "@/domain/data-sources/api-sports/types";

export function emptyIndependentContract057(): IndependentModelContract057 {
  return {
    model_probability: null,
    market_probability: null,
    edge: null,
    ev: null,
    decision: null,
    why: {
      primary_reason: "CONTRACT_ONLY_NO_MODEL",
      supporting_signals: [],
      negative_signals: [],
      missing_information: ["independent_model_not_implemented"],
    },
    note: "CONTRACT_ONLY_NO_MODEL_v3",
  };
}

/** Association stub for future learning — no writes to decision engine. */
export type FeatureAssociationStub057 = {
  prediction_id: string | null;
  features_snapshot_ref: string | null;
  decision_id: string | null;
  actual_result: string | null;
  source: "API_SPORTS";
  note: "PREPARED_FOR_FUTURE_LEARNING";
};
