/**
 * Product Fonti / explain allowlist.
 * Policy stubs, WAF-blocked sites, tennis dead ends, and token APIs without
 * keys stay out of the consulted board. Engine adapters may still exist.
 */
export const ACTIVE_FONTI_SOURCE_IDS = [
  "openligadb",
  "espn",
  "openfootball",
  "thesportsdb",
  "statsbomb",
  "football-data-co-uk",
  "ansa",
  "bbc-sport",
  "guardian-football",
  "gazzetta",
  "open-meteo",
  "understat",
  "club-football-match-data",
  "sky-sports",
  "espn-soccer-news",
  "corriere-sport",
  "tuttosport",
] as const;

export type ActiveFontiSourceId = (typeof ACTIVE_FONTI_SOURCE_IDS)[number];

/** Never listed as consulted on Fonti / explain — WAF, stubs, paywall, tennis. */
export const PRUNED_FONTI_SOURCE_IDS = [
  "sofascore",
  "fbref",
  "whoscored",
  "directa",
  "diretta",
  "flashscore",
  "soccerway",
  "soccervista",
  "soccervital",
  "uefa",
  "the-analyst",
  "abseits",
  "oddspedia",
  "betshoot",
  "click4soccer",
  "analysisportiva",
  "sportytrader",
  "ilveggente",
  "il-veggente",
  "opta",
  "opta-stats-perform",
  "soccer-association",
  "cies",
  "cies-football-observatory",
  "the-athletic",
  "tennis-abstract",
  "tennis-explorer",
  "tennisstats",
  "tennisinsight",
  "sky-sport",
  "sportradar-news",
  "thestatsapi",
] as const;

const ACTIVE = new Set<string>(ACTIVE_FONTI_SOURCE_IDS);
const PRUNED = new Set<string>(PRUNED_FONTI_SOURCE_IDS);

export function isActiveFontiSource(id: string): boolean {
  return ACTIVE.has(id);
}

export function isPrunedFontiSource(id: string): boolean {
  return PRUNED.has(id);
}

export function tokenEnvPresent(envName: string | undefined | null): boolean {
  if (!envName) return true;
  const v = process.env[envName];
  return Boolean(v && String(v).trim());
}
