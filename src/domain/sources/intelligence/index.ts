export type {
  SourceIntelligence,
  SourceRole,
  SourceCategory,
  SourceValueScore,
  AcquisitionPriority,
  DataGapRecommendation,
  ScoreComponent,
} from "./types";
export { SOURCE_ROLES, SOURCE_CATEGORIES, INTELLIGENCE_SPORTS } from "./types";
export {
  buildSourceIntelligenceCatalog,
  getSourceIntelligence,
  listByRole,
  listByTier,
  assertNoInventedReliability,
} from "./catalog";
export { computeIndependenceReport } from "./independence";
export { computeSourceValueScore } from "./value-score";
export { rankAcquisitionPriorities } from "./acquisition-priority";
export {
  buildSourceMarketMatrix,
  summarizeMarketSourceCoverage,
} from "./market-matrix";
export {
  computeDataGapRecommendations,
  selectNextBestAcquisition,
} from "./data-gap";
export { runSourceIntelligenceReport } from "./report";
