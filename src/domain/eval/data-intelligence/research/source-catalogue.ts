/**
 * Active product research catalogue — wired sources only.
 * Policy stubs, WAF sites, and tennis dead ends are not consulted on Fonti.
 */
import { isActiveFontiSource } from "@/domain/eval/acquisition-engine/active-fonti";

export type SourceAdapterKind =
  | "PRODUCTION_ADAPTER"
  | "TEST_PROBE"
  | "CACHE_ONLY"
  | "POLICY_DENIED"
  | "MISSING_ADAPTER";

export type CatalogueSource = {
  source_id: string;
  title: string;
  sport: "SOCCER" | "TENNIS" | "MULTI";
  adapter: SourceAdapterKind;
  /** Homepage / docs URL when known — not invented fetch success. */
  url: string | null;
  notes: string;
  /** Odds / market-derived — never enters independent MODEL. */
  market_layer: boolean;
};

function src(
  source_id: string,
  title: string,
  notes: string,
  extra?: Partial<CatalogueSource>,
): CatalogueSource {
  return {
    source_id,
    title,
    sport: extra?.sport ?? "SOCCER",
    adapter: extra?.adapter ?? "PRODUCTION_ADAPTER",
    url: extra?.url ?? null,
    notes,
    market_layer: extra?.market_layer ?? false,
  };
}

/**
 * Fonti / explain catalogue. Every row is a wired adapter. Zero MISSING_ADAPTER.
 */
export const RESEARCH_SOURCE_CATALOGUE: CatalogueSource[] = [
  src("openligadb", "OpenLigaDB", "Free API (BL1/2/3, DFB, Frauen-BL, UCL, Swiss SL, La Liga, PL). Identity fail-closed.", {
    url: "https://api.openligadb.de/getmatchdata/bl1",
  }),
  src("espn", "ESPN Scoreboard (unofficial)", "Unofficial site JSON after a real 200. Cached. No CAPTCHA. CONTEXT fixtures.", {
    sport: "MULTI",
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
  }),
  src("openfootball", "OpenFootball football.json", "Public GitHub season JSON. Historical DATE_ONLY. Not live. NOT_ELIGIBLE for independent model.", {
    url: "https://github.com/openfootball/football.json",
  }),
  src("thesportsdb", "TheSportsDB", "Free test key 3 — EU5 plus NL/PT/Championship/Serie B. CONTEXT meta only.", {
    url: "https://www.thesportsdb.com/api/v1/json/3/",
  }),
  src("statsbomb", "StatsBomb Open Data", "Historical open event/xG research. Not live. available_at unknown → NOT_ELIGIBLE.", {
    url: "https://github.com/statsbomb/open-data",
  }),
  src("football-data-co-uk", "Football-Data.co.uk", "Local matches.jsonl / historical — DATE_ONLY. B365 1X2 is MARKET/UI only, never independent MODEL.", {
    adapter: "CACHE_ONLY",
    url: "https://www.football-data.co.uk/",
  }),
  src("ansa", "ANSA", "Public RSS — CONTEXT only if both teams appear in the same item; never invents injuries", {
    sport: "MULTI",
    url: "https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml",
  }),
  src("bbc-sport", "BBC Sport Football RSS", "Public RSS — CONTEXT only; never invents injuries", {
    sport: "MULTI",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
  }),
  src("guardian-football", "The Guardian Football RSS", "Public RSS — CONTEXT only; never invents injuries", {
    sport: "MULTI",
    url: "https://www.theguardian.com/football/rss",
  }),
  src("gazzetta", "Gazzetta dello Sport RSS", "Public RSS — CONTEXT only; never invents injuries", {
    sport: "MULTI",
    url: "https://www.gazzetta.it/rss/calcio.xml",
  }),
  src("sky-sports", "Sky Sports Football RSS", "Public Sky Sports UK football RSS. CONTEXT only. Italian Sky Sport feed is 404 and not listed.", {
    sport: "MULTI",
    url: "https://www.skysports.com/rss/12040",
  }),
  src("espn-soccer-news", "ESPN Soccer News RSS", "Public ESPN soccer news RSS. CONTEXT only; never invents injuries", {
    sport: "MULTI",
    url: "https://www.espn.com/espn/rss/soccer/news",
  }),
  src("corriere-sport", "Corriere dello Sport RSS", "Public Corriere dello Sport calcio RSS. CONTEXT only.", {
    sport: "MULTI",
    url: "https://www.corrieredellosport.it/rss/calcio",
  }),
  src("tuttosport", "Tuttosport RSS", "Public Tuttosport calcio RSS. CONTEXT only.", {
    sport: "MULTI",
    url: "https://www.tuttosport.com/rss/calcio.xml",
  }),
  src("understat", "Understat", "Public getLeagueData XHR (X-Requested-With); rolling L5 xG/xGA CONTEXT only; available_at unknown so not MODEL", {
    url: "https://understat.com/",
  }),
  src("open-meteo", "Open-Meteo", "CONTEXT weather; needs stadium coords", {
    sport: "MULTI",
    url: "https://archive-api.open-meteo.com/",
  }),
  src("club-football-match-data", "Club-Football-Match-Data", "Local GitHub clone / CSV when present — research dataset", {
    adapter: "CACHE_ONLY",
    url: "https://github.com/xgabora/Club-Football-Match-Data",
  }),
];

export function catalogueById(id: string): CatalogueSource | undefined {
  return RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === id);
}

export function catalogueAdapterKind(sourceId: string): SourceAdapterKind | null {
  return catalogueById(sourceId)?.adapter ?? null;
}

export function isConsultedFontiSource(sourceId: string): boolean {
  return isActiveFontiSource(sourceId) && Boolean(catalogueById(sourceId));
}
