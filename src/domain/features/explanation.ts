import type { FeatureSnapshot } from "@/domain/features/matrix";
import type { FeatureCell } from "@/domain/features/types";

export type PredictionExplanation = {
  supportingFeatures: Array<{ featureId: string; note: string }>;
  contradictingFeatures: Array<{ featureId: string; note: string }>;
  marketComparison: {
    marketImplied: unknown;
    modelProbability: null;
    note: string;
  };
  dataQuality: {
    present: number;
    missing: number;
    blocked: number;
  };
  temporalQuality: {
    strictOrReconstructed: number;
    datasetWindow: number;
    unknownOrBlocked: number;
  };
  uncertainty: {
    /** Always descriptive until calibrated — never invent confidence. */
    confidence: null;
    notes: string[];
  };
};

function isPresent(cell: FeatureCell): boolean {
  return cell.value !== null && cell.status !== "MISSING";
}

export function buildPredictionExplanation(
  snapshot: FeatureSnapshot,
): PredictionExplanation {
  const cells = Object.values(snapshot.cells);
  let present = 0;
  let missing = 0;
  let blocked = 0;
  let strict = 0;
  let window = 0;
  let unknown = 0;
  const supporting: PredictionExplanation["supportingFeatures"] = [];
  const contradicting: PredictionExplanation["contradictingFeatures"] = [];

  for (const cell of cells) {
    if (cell.status === "MISSING") missing++;
    else if (cell.status === "BLOCKED" || cell.status === "REJECTED_LEAKAGE") {
      blocked++;
      unknown++;
    } else if (isPresent(cell)) {
      present++;
      if (
        cell.status === "STRICT" ||
        cell.status === "RECONSTRUCTED_STRICT"
      ) {
        strict++;
        supporting.push({
          featureId: cell.featureId,
          note: `status=${cell.status}`,
        });
      } else if (cell.status === "DATASET_WINDOW") {
        window++;
        supporting.push({
          featureId: cell.featureId,
          note: "dataset_window precision",
        });
      } else {
        unknown++;
        contradicting.push({
          featureId: cell.featureId,
          note: `weak temporal status=${cell.status}`,
        });
      }
    }
  }

  return {
    supportingFeatures: supporting.slice(0, 20),
    contradictingFeatures: contradicting,
    marketComparison: {
      marketImplied: snapshot.cells.market_implied_probability?.value ?? null,
      modelProbability: null,
      note: "Model probability not produced in TASK 007/007-A",
    },
    dataQuality: { present, missing, blocked },
    temporalQuality: {
      strictOrReconstructed: strict,
      datasetWindow: window,
      unknownOrBlocked: unknown,
    },
    uncertainty: {
      confidence: null,
      notes: [
        "Confidence remains null until calibrated out-of-sample metrics exist",
      ],
    },
  };
}
