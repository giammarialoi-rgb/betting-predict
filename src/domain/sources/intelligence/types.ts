/**
 * Source Intelligence V1 — catalog ≠ reliability; components may be UNKNOWN.
 */

export const SOURCE_ROLES = [
  "SOURCE",
  "PROVIDER",
  "UPSTREAM",
  "BOOKMAKER",
  "EXCHANGE",
  "AGGREGATOR",
] as const;

export type SourceRole = (typeof SOURCE_ROLES)[number];

export const SOURCE_CATEGORIES = [
  "OFFICIAL",
  "PRIMARY_DATA_PROVIDER",
  "SECONDARY_DATA_PROVIDER",
  "DATABASE",
  "HISTORICAL_DATASET",
  "ODDS_PROVIDER",
  "BOOKMAKER",
  "EXCHANGE",
  "NEWS",
  "INJURY",
  "LINEUP",
  "PLAYER_DATA",
  "TRACKING",
  "EVENT_DATA",
  "WEATHER",
  "ESPORTS",
  "ACADEMIC",
  "RESEARCH",
  "COMMUNITY",
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export const INTELLIGENCE_SPORTS = [
  "football",
  "basketball",
  "tennis",
  "baseball",
  "american_football",
  "ice_hockey",
  "rugby",
  "volleyball",
  "handball",
  "mma",
  "boxing",
  "golf",
  "formula_1",
  "motorsport",
  "cricket",
  "cycling",
  "athletics",
  "horse_racing",
  "esports",
  "multi",
] as const;

export type IntelligenceSport = (typeof INTELLIGENCE_SPORTS)[number];

export const INTELLIGENCE_CAPABILITIES = [
  "fixtures",
  "results",
  "odds",
  "historical_odds",
  "injuries",
  "lineups",
  "player_stats",
  "event_stats",
  "tracking",
  "news",
  "elo",
  "weather",
  "corners",
  "cards",
  "advanced_stats",
  "research",
] as const;

export type IntelligenceCapability = (typeof INTELLIGENCE_CAPABILITIES)[number];

export type SourceAccess =
  | "official_api"
  | "public_api"
  | "dataset"
  | "public_web"
  | "licensed_feed"
  | "exchange"
  | "bookmaker"
  | "unknown";

export type TemporalPrecisionIntel =
  | "exact"
  | "minute"
  | "date"
  | "dataset_window"
  | "unknown";

export type LicensingClass =
  | "open"
  | "free_api"
  | "commercial"
  | "research"
  | "unknown";

export type ReliabilityLabel = "verified" | "unverified" | "unknown";

export type ImplementationStatus =
  | "implemented"
  | "candidate"
  | "blocked"
  | "not_implemented";

export type ScoreComponent = number | "UNKNOWN";

export type SourceIntelligence = {
  id: string;
  name: string;
  url: string;
  sports: IntelligenceSport[];
  capabilities: IntelligenceCapability[];
  categories: SourceCategory[];
  /** Taxonomy role — never conflate. */
  role: SourceRole;
  geography: string[];
  languages: string[];
  access: SourceAccess;
  historicalDepth?: string;
  live: boolean;
  odds: boolean;
  injuries: boolean;
  lineups: boolean;
  playerStats: boolean;
  eventStats: boolean;
  tracking: boolean;
  news: boolean;
  temporalPrecision: TemporalPrecisionIntel;
  upstream?: string[];
  independenceCluster?: string;
  licensing: LicensingClass;
  /** Never invent — default unknown until audited. */
  reliability: ReliabilityLabel;
  implementation: ImplementationStatus;
  marketsSupported: string[];
  tier: "A" | "B" | "C";
};

export type SourceValueScore = {
  sourceId: string;
  coverage_score: ScoreComponent;
  temporal_score: ScoreComponent;
  granularity_score: ScoreComponent;
  historical_score: ScoreComponent;
  provenance_score: ScoreComponent;
  independence_score: ScoreComponent;
  access_score: ScoreComponent;
  /** Explicit: not a reliability percentage. */
  composite: ScoreComponent;
  notes: string[];
};

export type AcquisitionPriority = {
  sourceId: string;
  expected_information_gain: ScoreComponent;
  implementation_cost: ScoreComponent;
  priority_ratio: ScoreComponent;
  rationale: string[];
};

export type DataGapRecommendation = {
  gap_id: string;
  missing: string;
  why: string;
  candidate_sources: string[];
  expected_research_value: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  implementation_cost: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  temporal_precision: TemporalPrecisionIntel;
  next_best_acquisition: string;
};
