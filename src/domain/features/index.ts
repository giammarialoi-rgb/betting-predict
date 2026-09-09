export {
  FEATURE_REGISTRY,
  getFeatureDefinition,
  listFeaturesByStatus,
  listForbiddenFeatures,
} from "./registry";
export { computeFormPoints, computeFormBundle, priorMatchesForTeam } from "./form";
export {
  computeTeamHistoricalStats,
  sumLaggedStat,
  computeRestDays,
} from "./historical";
export {
  buildEloFeatures,
  selectEloAsOf,
  eloExpectedHomeProbability,
  classifyEloProvenance,
} from "./elo";
export { buildMarketFeatureCells } from "./market";
export { buildFeatureSnapshot } from "./matrix";
export { buildPredictionExplanation } from "./explanation";
export { footballFeatureProvider, getSportFeatureProvider } from "./sport-provider";
export { recordSourceDisagreement } from "./disagreement";
export {
  assertFeatureAvailableAsOf,
  assertNotForbiddenFeature,
  rejectPostEventStatAsPrematch,
  FeatureGateError,
} from "./gates";
export { runDataQualityChecks } from "./quality";
export { getFeatureLineage, FEATURE_LINEAGE } from "./lineage";
export {
  reconstructFormFromOutcomes,
  matchesWithLateAvailability,
} from "./form-persistable";
export type * from "./types";
export { buildFeatureEngineV3 } from "./engine-v3";
export { buildFeatureEngineV4 } from "./engine-v4";
export { computeLaggedGoalRates, estimatePoissonRatesFromHistory } from "./goal-rates";
export { clubEloAsOf, assertClubEloNotAfterAsOf } from "./clubelo-asof";
