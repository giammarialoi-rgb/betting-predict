/**
 * Source = origin of information.
 * Provider = a technical integration the software can call.
 * They are not the same: a source may have no API, and one provider may
 * aggregate many sources.
 *
 * Priority is research/integration order only. It is not reliability.
 * Reliability stays unknown until measured from observations.
 */
export const SOURCE_TYPES = [
  "api",
  "website",
  "dataset",
  "news",
  "research",
  "official",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_CAPABILITIES = [
  "fixtures",
  "results",
  "team_stats",
  "player_stats",
  "injuries",
  "lineups",
  "rankings",
  "historical_results",
  "advanced_stats",
  "news",
  "weather",
  "odds",
  "historical_odds",
  "research",
  "elo",
] as const;

export type SourceCapability = (typeof SOURCE_CAPABILITIES)[number];

export const SOURCE_PRIORITIES = ["high", "medium", "low"] as const;

export type SourcePriority = (typeof SOURCE_PRIORITIES)[number];

export const TRI_STATE = [true, false, "unknown"] as const;

export type TriState = (typeof TRI_STATE)[number];

export const QUALITY_DIMENSIONS = [
  "reliability",
  "freshness",
  "latency",
  "coverage",
  "completeness",
  "historicalDepth",
  "accuracy",
  "availability",
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

/** Empirical scores are not assigned in this catalog. Always "unknown". */
export type SourceQuality = {
  readonly [K in QualityDimension]: "unknown";
};

export type SourceDefinition = {
  readonly id: string;
  readonly name: string;
  readonly domain?: string;
  readonly sourceType: SourceType;
  readonly sports: readonly string[];
  readonly capabilities: readonly SourceCapability[];
  readonly historicalData: TriState;
  readonly realtime: TriState;
  readonly official: TriState;
  readonly requiresAuth: TriState;
  readonly freeTier: TriState;
  readonly scrapingAllowed: "unknown";
  readonly priority: SourcePriority;
  readonly quality: SourceQuality;
};

export function unknownQuality(): SourceQuality {
  return Object.freeze({
    reliability: "unknown",
    freshness: "unknown",
    latency: "unknown",
    coverage: "unknown",
    completeness: "unknown",
    historicalDepth: "unknown",
    accuracy: "unknown",
    availability: "unknown",
  });
}

export type SourceDiscoveryQuery = {
  sport: string;
  capability: SourceCapability;
  sourceType?: SourceType;
  freeOnly?: boolean;
};
