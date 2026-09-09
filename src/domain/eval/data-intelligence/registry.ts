import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import type { SourceEntry } from "@/domain/eval/data-intelligence/types";

/** Honest static registry — scrape sources RESEARCH_TEST only when gate on. */
export function buildSourceRegistry(input?: {
  footballDataRows?: number;
  clubeloCachePresent?: boolean;
  oddsApiConfigured?: boolean;
  apiSportsConfigured?: boolean;
  openMeteoOk?: boolean;
  testScrapeEnabled?: boolean;
}): SourceEntry[] {
  const fdRows = input?.footballDataRows ?? 0;
  const clubelo = Boolean(input?.clubeloCachePresent);
  const oddsApi = input?.oddsApiConfigured ?? Boolean(process.env.THE_ODDS_API_KEY);
  const apiSports = input?.apiSportsConfigured ?? Boolean(process.env.API_SPORTS_KEY);
  const testScrape = input?.testScrapeEnabled ?? isTestScrapeEnabled();
  const meteo = input?.openMeteoOk !== false;

  const scrapeEntry = (
    id: string,
    title: string,
    priority: "high" | "medium" | "low",
  ): SourceEntry =>
    testScrape
      ? {
          id,
          title,
          priority,
          role: "CONTEXT",
          temporal_precision: "UNKNOWN",
          status: "RESEARCH_TEST",
          reason: "BETMIND_TEST_SCRAPE=true — CONTEXT only; available_at usually UNKNOWN → NOT_ELIGIBLE STRICT",
          enters_independent_model: false,
          legal_status: "research_test",
        }
      : {
          id,
          title,
          priority,
          role: "DISABLED",
          temporal_precision: "N/A",
          status: "DISABLED_BY_POLICY",
          reason: "Scraping denied unless BETMIND_TEST_SCRAPE=true",
          enters_independent_model: false,
          legal_status: "forbidden",
        };

  return [
    {
      id: "football-data-co-uk",
      title: "Football-Data.co.uk",
      priority: "high",
      role: "MODEL_FEATURE",
      temporal_precision: "DATE_ONLY",
      status: fdRows >= 500 ? "ACTIVE" : fdRows > 0 ? "TEMPORALLY_CAUTIOUS" : "UNAVAILABLE",
      reason:
        fdRows >= 500
          ? `PI historical rows=${fdRows}; result_available_at DATE_ONLY`
          : fdRows > 0
            ? `Dataset present but below ACTIVE threshold (${fdRows})`
            : "No matches.jsonl imported",
      enters_independent_model: true,
      legal_status: "public",
    },
    {
      id: "the-odds-api",
      title: "The Odds API / Lab B quotes",
      priority: "high",
      role: "MARKET_COMPARE",
      temporal_precision: "STRICT_AS_OF",
      status: oddsApi ? "ACTIVE" : "UNAVAILABLE",
      reason: oddsApi
        ? "Live quotes for MARKET baseline + market-intelligence COMPARE_ONLY"
        : "THE_ODDS_API_KEY not configured; Lab B quote history may still exist on disk",
      enters_independent_model: false,
      legal_status: "licensed",
    },
    {
      id: "clubelo",
      title: "ClubElo",
      priority: "medium",
      role: "MODEL_FEATURE",
      temporal_precision: "DATE_ONLY",
      status: clubelo ? "ACTIVE_ASOF" : "UNAVAILABLE",
      reason: clubelo
        ? "Local CSV cache present; rating_date < match_date gate"
        : "No local ClubElo cache — will not fetch during audit; features UNAVAILABLE",
      enters_independent_model: clubelo,
      legal_status: "public",
    },
    {
      id: "open-meteo",
      title: "Open-Meteo",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "STRICT_AS_OF",
      status: meteo ? "ACTIVE" : "UNAVAILABLE",
      reason: "Official archive API; CONTEXT weather; not MODEL input in this phase",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "api-sports",
      title: "API-Sports v3",
      priority: "high",
      role: "MODEL_FEATURE",
      temporal_precision: "STRICT_AS_OF",
      status: apiSports ? "FOUNDATION" : "PLAN_LIMITED",
      reason: apiSports
        ? "Injuries/lineups MODEL only when available_at demonstrable; else NOT_ELIGIBLE"
        : "API_SPORTS_KEY missing; injuries/lineups UNAVAILABLE",
      enters_independent_model: true,
      legal_status: "licensed",
    },
    scrapeEntry("fbref", "FBRef", "medium"),
    scrapeEntry("understat", "Understat", "medium"),
    scrapeEntry("uefa", "UEFA statistics", "high"),
    scrapeEntry("sofascore", "SofaScore", "low"),
    {
      id: "sportradar-news",
      title: "Sportradar News",
      priority: "low",
      role: "DISABLED",
      temporal_precision: "N/A",
      status: "DISABLED_BY_POLICY",
      reason: "Commercial / not licensed in this lab",
      enters_independent_model: false,
      legal_status: "forbidden",
    },
    {
      id: "thestatsapi",
      title: "TheStatsAPI",
      priority: "low",
      role: "DISABLED",
      temporal_precision: "N/A",
      status: "CANDIDATE",
      reason: "Commercial candidate; not wired",
      enters_independent_model: false,
      legal_status: "unknown",
    },
  ];
}

export function findClubEloCachePaths(cwd = process.cwd()): string[] {
  const candidates = [
    join(cwd, "data", "clubelo"),
    join(cwd, "artifacts", "clubelo"),
    join(cwd, "audit", "external", "task-044", "predictive-intelligence", "clubelo"),
  ];
  const out: string[] = [];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      for (const name of readdirSync(dir)) {
        if (name.toLowerCase().endsWith(".csv")) out.push(join(dir, name));
      }
    } catch {
      /* ignore */
    }
  }
  const single = join(cwd, "data", "clubelo.csv");
  if (existsSync(single)) out.push(single);
  return out;
}

export function clubEloCachePresent(cwd = process.cwd()): boolean {
  return findClubEloCachePaths(cwd).length > 0;
}
