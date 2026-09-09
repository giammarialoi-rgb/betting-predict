export type {
  SourceEntry,
  DataSourceRole,
  DataSourceStatus,
  DataIntelligenceAuditResult,
  SourceObservation,
  PrematchFeatureObservation,
  SynthesisResult,
} from "@/domain/eval/data-intelligence/types";
export {
  buildSourceRegistry,
  clubEloCachePresent,
  findClubEloCachePaths,
} from "@/domain/eval/data-intelligence/registry";
export {
  loadClubEloCacheSync,
  parseClubEloCsvSync,
  resolveTeamEloAsOf,
  clubKeyFromTeamName,
} from "@/domain/eval/data-intelligence/clubelo-cache";
export {
  runDataIntelligenceAudit,
  dataIntelligenceRoot,
} from "@/domain/eval/data-intelligence/audit";
export {
  synthesizePrematchFacts,
  applySynthesisConfidenceAdjust,
} from "@/domain/eval/data-intelligence/synthesis";
export {
  synthesizeFeatureBag,
  mergeDiIntoFeatureVector,
  applyFeatureBagConfidenceAdjust,
} from "@/domain/eval/data-intelligence/feature-bag";
export {
  FEATURE_MANIFEST_P0,
  featureManifestP0Summary,
  DI_MODEL_MERGE_KEYS,
} from "@/domain/eval/data-intelligence/feature-manifest";
export {
  buildEventDiContext,
  ensureDataIntelligenceContext,
  readDataIntelligenceCoverageSummary,
} from "@/domain/eval/data-intelligence/context";
export { fetchOpenMeteoContext, resolveStadiumCoords } from "@/domain/eval/data-intelligence/open-meteo";
export {
  classifyObservationAsOf,
  observationBlockedFuture,
  toFeatureDatum,
  prematchFromSourceObservation,
} from "@/domain/eval/data-intelligence/observation";
export {
  fetchApiSportsPrematchObservations,
  loadApiSportsPrematchFromCacheSync,
} from "@/domain/eval/data-intelligence/adapters/api-sports-prematch";
export {
  probeScrapeSource,
  runTestScrapeProbes,
  parseFbrefStub,
} from "@/domain/eval/data-intelligence/scrape/probe";
export { isTestScrapeEnabled, scrapingAllowedForSource } from "@/domain/sources/scraping-policy";
