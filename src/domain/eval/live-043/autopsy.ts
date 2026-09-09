import { brier3 } from "@/domain/eval/capital-020/models";
import type { Decision039, Outcome039, Settlement039 } from "@/domain/eval/live-039/types";
import type { AutopsyClass043, AutopsyRecord043, PredictionRecord043 } from "@/domain/eval/live-043/types";

function outcomeIdx(o: Exclude<Outcome039, "UNSETTLED">): 0 | 1 | 2 {
  if (o === "HOME") return 0;
  if (o === "DRAW") return 1;
  return 2;
}

export function runAutopsy043(input: {
  prediction: PredictionRecord043;
  decision: Decision039 | null;
  settlement: Settlement039;
}): AutopsyRecord043 {
  const classes: AutopsyClass043[] = [];
  let brier: number | null = null;
  let err: number | null = null;

  if (input.settlement.outcome === "UNSETTLED") {
    return {
      event_id: input.prediction.event_id,
      model_version: input.prediction.model_version,
      classes: ["INSUFFICIENT_INFORMATION"],
      prediction_error: null,
      brier: null,
      notes: "settlement unsettled",
      learning_candidate: false,
      created_at: new Date().toISOString(),
    };
  }

  const actual = outcomeIdx(input.settlement.outcome);
  const p = input.decision
    ? ([input.decision.home_devig, input.decision.draw_devig, input.decision.away_devig] as [number, number, number])
    : input.prediction.model_probability
      ? ([
          input.prediction.model_probability.HOME ?? 1 / 3,
          input.prediction.model_probability.DRAW ?? 1 / 3,
          input.prediction.model_probability.AWAY ?? 1 / 3,
        ] as [number, number, number])
      : null;

  if (!p) {
    classes.push("INSUFFICIENT_INFORMATION", "DATA_QUALITY");
  } else {
    brier = brier3(p, actual);
    err = 1 - p[actual]!;
    if (p[actual]! < 0.25) classes.push("MODEL_OVERCONFIDENCE");
    else if (p[actual]! > 0.55 && brier < 0.2) classes.push("RANDOM_VARIANCE");
    else classes.push("BAD_CALIBRATION");
    if (input.prediction.data_quality < 0.4) classes.push("DATA_QUALITY");
    if (input.prediction.model_version === "MODEL_v1") classes.push("MISSED_FEATURE");
  }

  const learning = classes.some((c) =>
    ["MODEL_OVERCONFIDENCE", "MISSED_FEATURE", "BAD_CALIBRATION", "BAD_MODEL_SPECIFICATION"].includes(c),
  );

  return {
    event_id: input.prediction.event_id,
    model_version: input.prediction.model_version,
    classes: [...new Set(classes)],
    prediction_error: err,
    brier,
    notes: `autopsy for ${input.settlement.outcome}`,
    learning_candidate: learning,
    created_at: new Date().toISOString(),
  };
}
