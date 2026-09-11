/**
 * Operational source registry — extends the existing catalogue, does not replace it.
 */
import { RESEARCH_SOURCE_CATALOGUE, type CatalogueSource } from "@/domain/eval/data-intelligence/research/source-catalogue";

export type SourceCategory =
  | "EVENT_DISCOVERY"
  | "RESULTS_HISTORY"
  | "FORM"
  | "TEAM_STATS"
  | "PLAYER_STATS"
  | "INJURIES"
  | "LINEUPS"
  | "XG"
  | "REFEREE"
  | "ADVANCED_STATS"
  | "WEATHER"
  | "ODDS_MARKET";

export type SourceRegistryEntry = CatalogueSource & {
  categories: SourceCategory[];
  mode: "API" | "HTML" | "SCRAPE" | "ARCHIVE" | "FEED" | "CACHE";
  priority: number;
  timeout_ms: number;
  rate_limit_per_min: number | null;
  reliability: null;
};

const CATEGORIES: Record<string, SourceCategory[]> = {
  "the-odds-api": ["EVENT_DISCOVERY", "ODDS_MARKET"],
  "football-data-co-uk": ["RESULTS_HISTORY", "FORM", "TEAM_STATS"],
  "club-football-match-data": ["RESULTS_HISTORY", "FORM"],
  clubelo: ["TEAM_STATS"],
  "api-sports": ["INJURIES", "LINEUPS", "TEAM_STATS"],
  "open-meteo": ["WEATHER"],
  fbref: ["TEAM_STATS", "XG", "ADVANCED_STATS", "FORM"],
  understat: ["XG", "TEAM_STATS"],
  sofascore: ["EVENT_DISCOVERY", "LINEUPS", "INJURIES", "TEAM_STATS"],
  uefa: ["EVENT_DISCOVERY", "LINEUPS"],
  directa: ["EVENT_DISCOVERY", "LINEUPS", "RESULTS_HISTORY"],
  flashscore: ["EVENT_DISCOVERY", "RESULTS_HISTORY"],
  soccerway: ["RESULTS_HISTORY", "FORM"],
};

const MODE: Record<string, SourceRegistryEntry["mode"]> = {
  "the-odds-api": "API",
  "football-data-co-uk": "ARCHIVE",
  "club-football-match-data": "ARCHIVE",
  clubelo: "CACHE",
  "api-sports": "CACHE",
  "open-meteo": "API",
  fbref: "SCRAPE",
  understat: "API",
  sofascore: "SCRAPE",
  uefa: "HTML",
  directa: "SCRAPE",
  flashscore: "SCRAPE",
  soccerway: "SCRAPE",
};

export function sourceRegistry(): SourceRegistryEntry[] {
  return RESEARCH_SOURCE_CATALOGUE.map((cat, i) => ({
    ...cat,
    categories: CATEGORIES[cat.source_id] ?? [],
    mode: MODE[cat.source_id] ?? (cat.adapter === "MISSING_ADAPTER" ? "HTML" : "CACHE"),
    priority: i,
    timeout_ms: 12_000,
    rate_limit_per_min: cat.adapter === "TEST_PROBE" ? 6 : 20,
    reliability: null,
  }));
}

export function sourcesForCategory(cat: SourceCategory): SourceRegistryEntry[] {
  return sourceRegistry().filter((s) => s.categories.includes(cat));
}
