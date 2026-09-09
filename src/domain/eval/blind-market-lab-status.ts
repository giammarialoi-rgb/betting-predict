import { runBlindMarketLabV1 } from "@/domain/eval/blind-market-lab";
import { FOOTBALL_DATA_CO_UK_LIVE_STATUS } from "@/domain/sources/provider-status";
import { FOOTBALL_ACQUISITION_MARKET_CATALOG } from "@/domain/markets/acquisition-catalog";
import { cataloguedStatPlaceholders } from "@/domain/stats/capability-registry";
import { discoverAcquisitionTargets } from "@/domain/acquisition/football-data-co-uk";

/** Light status for UI (avoids re-running full lab on every render when cached). */
export function getBlindMarketLabStatus() {
  return {
    experiment: "exp_013_blind_market_lab_v1",
    liveProvider: FOOTBALL_DATA_CO_UK_LIVE_STATUS.provider_status,
    liveReason: FOOTBALL_DATA_CO_UK_LIVE_STATUS.reason,
    acquisitionTargetsCatalogued: discoverAcquisitionTargets().length,
    marketsCatalogued: FOOTBALL_ACQUISITION_MARKET_CATALOG.length,
    statCapabilities: cataloguedStatPlaceholders().length,
    champion: "market_devig",
    realMoney: false as const,
    modelReady: 0,
  };
}

export function getBlindMarketLabReport() {
  return runBlindMarketLabV1();
}
