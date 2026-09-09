/**
 * Provider / market coverage registries — verified facts only.
 * UNKNOWN when not independently confirmed. Never invent availability.
 */

export type CoverageStatus = "VERIFIED" | "PARTIAL" | "UNKNOWN" | "BLOCKED";

export type ProviderCoverageRecord = {
  provider: string;
  sport: string;
  market: string;
  lines: number[] | "unknown";
  live: CoverageStatus;
  historical: CoverageStatus;
  source: string;
  temporalPrecision: "exact" | "unknown" | "dataset_window" | "mixed" | "UNKNOWN";
  status: CoverageStatus;
};

export type MarketCoverageRecord = {
  sport: string;
  market: string;
  catalogued: true;
  observed: boolean;
  modelReady: false;
  bookmakersKnown: string[];
  notes: string;
};

/** Only rows we have actually verified in-repo. */
export const PROVIDER_COVERAGE_REGISTRY: readonly ProviderCoverageRecord[] =
  Object.freeze([
    {
      provider: "football-data-co-uk",
      sport: "football",
      market: "result",
      lines: [],
      live: "BLOCKED",
      historical: "VERIFIED",
      source: "football-data-co-uk",
      temporalPrecision: "unknown",
      status: "VERIFIED",
    },
    {
      provider: "football-data-co-uk",
      sport: "football",
      market: "total_goals",
      lines: [2.5],
      live: "BLOCKED",
      historical: "PARTIAL",
      source: "football-data-co-uk",
      temporalPrecision: "unknown",
      status: "PARTIAL",
    },
    {
      provider: "football-data-org",
      sport: "football",
      market: "result",
      lines: [],
      live: "UNKNOWN",
      historical: "PARTIAL",
      source: "football-data-org",
      temporalPrecision: "UNKNOWN",
      status: "PARTIAL",
    },
    {
      provider: "clubelo",
      sport: "football",
      market: "elo_rating",
      lines: [],
      live: "UNKNOWN",
      historical: "VERIFIED",
      source: "clubelo",
      temporalPrecision: "dataset_window",
      status: "VERIFIED",
    },
    {
      provider: "mock-odds",
      sport: "football",
      market: "result",
      lines: [],
      live: "BLOCKED",
      historical: "VERIFIED",
      source: "mock-odds",
      temporalPrecision: "exact",
      status: "VERIFIED",
    },
  ]);

export const MARKET_COVERAGE_REGISTRY: readonly MarketCoverageRecord[] =
  Object.freeze([
    {
      sport: "football",
      market: "result",
      catalogued: true,
      observed: true,
      modelReady: false,
      bookmakersKnown: ["bet365", "pinnacle", "william-hill"],
      notes: "Observed in offline pack; MODEL_READY remains false",
    },
    {
      sport: "football",
      market: "total_goals",
      catalogued: true,
      observed: true,
      modelReady: false,
      bookmakersKnown: ["bet365"],
      notes: "OU 2.5 observed; other lines catalog-only until verified",
    },
    {
      sport: "football",
      market: "both_teams_to_score",
      catalogued: true,
      observed: false,
      modelReady: false,
      bookmakersKnown: [],
      notes: "Catalog capability only",
    },
    {
      sport: "football",
      market: "corners",
      catalogued: true,
      observed: false,
      modelReady: false,
      bookmakersKnown: [],
      notes: "Catalog capability only",
    },
    {
      sport: "football",
      market: "cards",
      catalogued: true,
      observed: false,
      modelReady: false,
      bookmakersKnown: [],
      notes: "Catalog capability only",
    },
  ]);

export function listProviderCoverage(
  filter?: Partial<Pick<ProviderCoverageRecord, "sport" | "provider">>,
): ProviderCoverageRecord[] {
  return PROVIDER_COVERAGE_REGISTRY.filter((r) => {
    if (filter?.sport && r.sport !== filter.sport) return false;
    if (filter?.provider && r.provider !== filter.provider) return false;
    return true;
  });
}

export function listMarketCoverage(sport?: string): MarketCoverageRecord[] {
  return MARKET_COVERAGE_REGISTRY.filter((r) =>
    sport ? r.sport === sport : true,
  );
}
