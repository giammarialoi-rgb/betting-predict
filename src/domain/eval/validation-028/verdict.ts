import type { ScientificVerdict028 } from "@/domain/eval/validation-028/types";

export function scientificVerdict028(input: {
  fixture: boolean;
  testN: number;
  holdoutN: number;
  modelBeatsFrequencyTest: boolean;
  modelBeatsMarketTest: boolean;
  testRoi: number | null;
  testCiLow: number | null;
  holdoutRoi: number | null;
  holdoutCiLow: number | null;
  holmRejectsMarketEdge: boolean;
  projectCalendarHoldoutN: number;
}): ScientificVerdict028 {
  if (input.fixture) return "INSUFFICIENT_DATA";
  if (input.testN < 100) return "INSUFFICIENT_DATA";
  if (input.holmRejectsMarketEdge && (input.holdoutCiLow ?? -1) > 0 && input.projectCalendarHoldoutN > 0) {
    return "ROBUST_OUT_OF_SAMPLE_EDGE";
  }
  if (input.holmRejectsMarketEdge && (input.testCiLow ?? -1) > 0 && input.holdoutN > 0) {
    if ((input.holdoutRoi ?? 0) <= 0 || (input.holdoutCiLow ?? 0) <= 0) return "EDGE_DETECTED_NOT_ROBUST";
    return "EDGE_STATISTICALLY_SUPPORTED";
  }
  if ((input.testRoi ?? 0) > 0 && (input.testCiLow ?? 0) <= 0) {
    return "POSITIVE_OBSERVED_RETURN_NOT_SIGNIFICANT";
  }
  if (input.modelBeatsFrequencyTest && !input.modelBeatsMarketTest) {
    return "PREDICTIVE_SIGNAL_BUT_NO_MARKET_EDGE";
  }
  return "NO_SIGNAL";
}

export function promotion028(input: {
  beatsMarketTest: boolean;
  beatsMarketHoldout: boolean;
  calOk: boolean;
  ciPosTest: boolean;
  holmOk: boolean;
  projectHoldoutN: number;
  multiLeague: boolean;
  multiSeason: boolean;
  frozenThreshold: boolean;
}): { promotion: false; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.beatsMarketTest) reasons.push("does not improve market baseline on TEST");
  if (!input.beatsMarketHoldout) reasons.push("not replicated on corpus HOLDOUT");
  if (!input.calOk) reasons.push("calibration not acceptable");
  if (!input.ciPosTest) reasons.push("TEST ROI 95% CI not strictly positive");
  if (!input.holmOk) reasons.push("multiple-testing correction not passed");
  if (input.projectHoldoutN === 0) reasons.push("project calendar HOLDOUT 2020+ has zero STRICT events");
  if (!input.multiLeague) reasons.push("not shown independent of a single league");
  if (!input.multiSeason) reasons.push("not shown independent of a single season");
  if (!input.frozenThreshold) reasons.push("threshold not frozen");
  return { promotion: false, reasons };
}
