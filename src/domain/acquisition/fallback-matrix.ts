/**
 * Source fallback matrix — market → primary/secondary/tertiary.
 */

export type FallbackTier = {
  market: string;
  primary: string[];
  secondary: string[];
  tertiary: string[];
};

export const SOURCE_FALLBACK_MATRIX: readonly FallbackTier[] = Object.freeze([
  {
    market: "result",
    primary: ["football-data-co-uk", "football-data-org"],
    secondary: ["club-football-match-data"],
    tertiary: [],
  },
  {
    market: "total_goals",
    primary: ["football-data-co-uk"],
    secondary: [],
    tertiary: [],
  },
  {
    market: "elo",
    primary: ["clubelo"],
    secondary: ["club-football-match-data"],
    tertiary: [],
  },
  {
    market: "weather",
    primary: ["open-meteo"],
    secondary: [],
    tertiary: [],
  },
  {
    market: "odds",
    primary: ["football-data-co-uk"],
    secondary: [],
    tertiary: [],
  },
  {
    market: "corners",
    primary: [],
    secondary: [],
    tertiary: [],
  },
  {
    market: "cards",
    primary: [],
    secondary: [],
    tertiary: [],
  },
  {
    market: "player_props",
    primary: [],
    secondary: [],
    tertiary: [],
  },
]);

export function resolveFallback(market: string): {
  available: string[];
  status: "OK" | "MISSING";
} {
  const row = SOURCE_FALLBACK_MATRIX.find((r) => r.market === market);
  if (!row) return { available: [], status: "MISSING" };
  const available = [...row.primary, ...row.secondary, ...row.tertiary];
  return {
    available,
    status: available.length === 0 ? "MISSING" : "OK",
  };
}
