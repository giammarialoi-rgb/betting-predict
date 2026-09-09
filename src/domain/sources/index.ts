export {
  assertCatalogIntegrity,
  findCandidateSources,
  getSource,
  getSourcesByCapability,
  getSourcesForSport,
  getSourcesForSportAndCapability,
  isSourceType,
  listSources,
} from "./catalog";
export {
  QUALITY_DIMENSIONS,
  SOURCE_CAPABILITIES,
  SOURCE_PRIORITIES,
  SOURCE_TYPES,
  unknownQuality,
  type QualityDimension,
  type SourceCapability,
  type SourceDefinition,
  type SourceDiscoveryQuery,
  type SourcePriority,
  type SourceQuality,
  type SourceType,
  type TriState,
} from "./types";
export * from "./intelligence";
export {
  buildSourceAvailabilityMatrix,
  summarizeSourceAvailability,
  alternativesWhenBlocked,
} from "./availability-matrix";
export { SCRAPING_DEFAULT, scrapingAllowedForSource, assertScrapingDenied } from "./scraping-policy";
export {
  FOOTBALL_DATA_CO_UK_LIVE_STATUS,
  FOOTBALL_DATA_CO_UK_TARGET_DIVISIONS,
  recordProviderBlocked,
} from "./provider-status";
