import { getMultiMarketPlatformStatus } from "@/domain/eval/platform-status";
import { FOOTBALL_DATA_CO_UK_LIVE_STATUS } from "@/domain/sources/provider-status";
import { runExperiment012 } from "@/domain/eval/experiment-012";

export function getAcquisition012Status() {
  const platform = getMultiMarketPlatformStatus();
  // Page status: MODEL_READY stays 0 until gates pass (exact precision + sample + holdout).
  const modelReady = 0;
  return {
    ...platform,
    footballDataCoUk: FOOTBALL_DATA_CO_UK_LIVE_STATUS.provider_status,
    footballDataCoUkReason: FOOTBALL_DATA_CO_UK_LIVE_STATUS.reason,
    modelReadyMarkets: modelReady,
    experiment012: "READY" as const,
    riskEngine: "SIMULATABLE" as const,
    bankrollReplay: "READY" as const,
    coverageMatrix: "READY" as const,
    clubEloAsOf: "READY" as const,
    goalPoissonBaseline: "READY" as const,
  };
}

/** Full experiment for tests / offline runs only. */
export { runExperiment012 };
