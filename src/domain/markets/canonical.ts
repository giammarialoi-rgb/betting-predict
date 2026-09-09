/**
 * Canonical market observation model — market-agnostic.
 * Catalog MarketDefinition remains taxonomy; this is an observed quote identity.
 */

export type MarketPeriod = "FT" | "HT" | "H1" | "H2" | "SET" | "GAME" | "RACE" | "OTHER";

export type CanonicalMarketObservation = {
  sport: string;
  marketType: string;
  period: MarketPeriod;
  line: number | null;
  selection: string;
  selectionRef?: string | null;
  teamRef?: string | null;
  playerRef?: string | null;
};

export function canonicalMarketKey(obs: CanonicalMarketObservation): string {
  const line = obs.line === null || obs.line === undefined ? "" : String(obs.line);
  const selRef = obs.selectionRef ?? "";
  const team = obs.teamRef ?? "";
  const player = obs.playerRef ?? "";
  return [
    obs.sport,
    obs.marketType,
    obs.period,
    line,
    obs.selection,
    selRef,
    team,
    player,
  ].join("|");
}

/** Aggregates that must never be stored as bookmakers. */
export const NON_BOOKMAKER_AGGREGATES = [
  "max",
  "avg",
  "average",
  "best",
  "bbmax",
  "bbav",
  "bbmean",
] as const;

export function assertNotAggregateAsBookmaker(slug: string): void {
  const s = slug.toLowerCase();
  for (const a of NON_BOOKMAKER_AGGREGATES) {
    if (s === a || s.startsWith(`${a}-`) || s.startsWith(`${a}_`)) {
      throw new Error(
        `AGGREGATE_NOT_BOOKMAKER: "${slug}" is Max/Avg/Best aggregate, not a bookmaker`,
      );
    }
  }
}

export function isAggregateOddsLabel(label: string): boolean {
  const s = label.toLowerCase();
  return (
    s.startsWith("max") ||
    s.startsWith("avg") ||
    s.startsWith("bbmax") ||
    s.startsWith("bbav") ||
    s === "best"
  );
}
