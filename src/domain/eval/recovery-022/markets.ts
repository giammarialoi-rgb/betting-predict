const CATALOG_MARKETS = [
  "1X2",
  "OU",
  "AH",
  "BTTS",
  "DC",
  "DNB",
  "HT",
  "correct_score",
  "team_goals",
  "corners",
  "cards",
  "player",
  "other",
] as const;

export type CatalogMarket022 = (typeof CATALOG_MARKETS)[number];

/** PHP generators filter bettype = '1x2' only. Do not invent other markets. */
export function classifyBettype(raw: string | null): CatalogMarket022 | null {
  if (raw == null || raw.trim() === "") return null;
  const s = raw.trim().toLowerCase();
  if (s === "1x2" || s === "1x2ft" || s === "match_odds") return "1X2";
  if (s === "ou" || s === "overunder" || s === "totals") return "OU";
  if (s === "ah" || s === "asian" || s === "handicap") return "AH";
  if (s === "btts") return "BTTS";
  if (s === "dc" || s === "doublechance") return "DC";
  if (s === "dnb") return "DNB";
  if (s === "ht" || s === "ht1x2") return "HT";
  if (s === "cs" || s === "correct_score") return "correct_score";
  if (s.includes("corner")) return "corners";
  if (s.includes("card")) return "cards";
  if (s.includes("player")) return "player";
  return "other";
}

export const OBSERVED_IN_BTB_GENERATORS: readonly CatalogMarket022[] = ["1X2"];
export const CATALOGUED_NOT_OBSERVED_022: readonly CatalogMarket022[] = CATALOG_MARKETS.filter(
  (m) => m !== "1X2",
);
