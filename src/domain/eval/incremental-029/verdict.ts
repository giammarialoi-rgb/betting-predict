import type { Verdict029 } from "@/domain/eval/incremental-029/types";

export function verdict029(input: {
  fixture: boolean;
  testN: number;
  leakageFail: boolean;
  anyBeatsMarketTest: boolean;
  holmRejects: boolean;
  holdoutAlsoBeats: boolean;
  singleLeague: boolean;
  projectHoldoutN: number;
}): Verdict029 {
  if (input.leakageFail) return "LEAKAGE_DETECTED";
  if (input.fixture || input.testN < 100) return "INSUFFICIENT_DATA";
  if (input.anyBeatsMarketTest && input.holmRejects && input.holdoutAlsoBeats && !input.singleLeague) {
    return "INCREMENTAL_SIGNAL_CONFIRMED";
  }
  if (input.anyBeatsMarketTest && (input.singleLeague || !input.holdoutAlsoBeats || !input.holmRejects)) {
    return "LOCAL_SIGNAL_ONLY";
  }
  return "NO_INCREMENTAL_INFORMATION";
}
