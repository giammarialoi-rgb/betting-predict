/**
 * Known free endpoints. Discovery maps these URLs; no CAPTCHA/WAF bypass.
 * Tavily/Context may add candidates later — they never replace this allowlist.
 */
import type { AcquisitionJob, AcquisitionKind } from "@/domain/eval/acquisition-engine/types";
import type { LicenseClass } from "@/domain/alignment-ids";
import { tokenEnvPresent } from "@/domain/eval/acquisition-engine/active-fonti";

export type FreeSourceDef = {
  source_id: string;
  title: string;
  title_it: string;
  license_class: LicenseClass;
  kind: AcquisitionKind;
  url: string;
  rate_limit_ms: number;
  notes: string;
  notes_it: string;
  market_layer: boolean;
  live: boolean;
  unofficial?: boolean;
  /** Product Fonti board. Default true. */
  fonti_active?: boolean;
  /** Skip engine discovery unless this env var is a non-empty token. */
  requires_token?: string;
};

export const BLOCKED_PROTECTED_SOURCES = [
  {
    source_id: "sofascore",
    title: "SofaScore",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "SofaScore restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato di questa fonte e stato utilizzato.",
  },
  {
    source_id: "fbref",
    title: "FBref",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "FBref restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato di questa fonte e stato utilizzato.",
  },
  {
    source_id: "whoscored",
    title: "WhoScored",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "WhoScored restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato di questa fonte e stato utilizzato.",
  },
] as const;

/** OpenLigaDB public shortcuts verified with ordinary GET (no key). Empty arrays are not listed. */
export const OPENLIGA_LEAGUES = [
  { shortcut: "bl1", label: "1. Bundesliga" },
  { shortcut: "bl2", label: "2. Bundesliga" },
  { shortcut: "bl3", label: "3. Liga" },
  { shortcut: "dfb", label: "DFB-Pokal" },
  { shortcut: "fbl1", label: "Frauen-Bundesliga" },
  { shortcut: "ucl", label: "UEFA Champions League" },
  { shortcut: "ch1", label: "Swiss Super League" },
  { shortcut: "la1", label: "La Liga" },
  { shortcut: "pl", label: "Premier League" },
] as const;

/** TheSportsDB free test-key soccer leagues (key=3). */
export const THESPORTSDB_LEAGUES = [
  { id: "4328", label: "English Premier League" },
  { id: "4332", label: "Italian Serie A" },
  { id: "4335", label: "Spanish La Liga" },
  { id: "4331", label: "German Bundesliga" },
  { id: "4334", label: "French Ligue 1" },
  { id: "4337", label: "Dutch Eredivisie" },
  { id: "4344", label: "Portuguese Primeira Liga" },
  { id: "4329", label: "English Championship" },
  { id: "4394", label: "Italian Serie B" },
] as const;

/** football-data.co.uk free CSVs. Odds columns stay MARKET layer. */
export const FDOUK_DIVISIONS = [
  { code: "E0", label: "Premier League" },
  { code: "E1", label: "Championship" },
  { code: "I1", label: "Serie A" },
  { code: "I2", label: "Serie B" },
  { code: "SP1", label: "La Liga" },
  { code: "SP2", label: "Segunda Division" },
  { code: "D1", label: "Bundesliga" },
  { code: "D2", label: "2. Bundesliga" },
  { code: "F1", label: "Ligue 1" },
  { code: "F2", label: "Ligue 2" },
  { code: "N1", label: "Eredivisie" },
  { code: "P1", label: "Primeira Liga" },
  { code: "SC0", label: "Scottish Premiership" },
  { code: "B1", label: "Belgian Pro League" },
  { code: "T1", label: "Turkish Super Lig" },
  { code: "G1", label: "Greek Super League" },
] as const;

/** ESPN unofficial site JSON — allowlisted only after a real 200 without CAPTCHA. */
export const ESPN_SCOREBOARDS = [
  { slug: "eng.1", sport: "soccer", label: "Premier League" },
  { slug: "ita.1", sport: "soccer", label: "Serie A" },
  { slug: "ger.1", sport: "soccer", label: "Bundesliga" },
  { slug: "esp.1", sport: "soccer", label: "La Liga" },
  { slug: "fra.1", sport: "soccer", label: "Ligue 1" },
  { slug: "uefa.champions", sport: "soccer", label: "UEFA Champions League" },
  { slug: "uefa.europa", sport: "soccer", label: "UEFA Europa League" },
  { slug: "ned.1", sport: "soccer", label: "Eredivisie" },
  { slug: "por.1", sport: "soccer", label: "Primeira Liga" },
  { slug: "eng.2", sport: "soccer", label: "Championship" },
  { slug: "ita.2", sport: "soccer", label: "Serie B" },
  { slug: "bel.1", sport: "soccer", label: "Belgian Pro League" },
  { slug: "tur.1", sport: "soccer", label: "Turkish Super Lig" },
  { slug: "sco.1", sport: "soccer", label: "Scottish Premiership" },
] as const;

export const OPENFOOTBALL_PACKS = [
  { path: "2025-26/en.1.json", label: "Premier League 2025/26" },
  { path: "2025-26/it.1.json", label: "Serie A 2025/26" },
  { path: "2025-26/es.1.json", label: "La Liga 2025/26" },
  { path: "2025-26/de.1.json", label: "Bundesliga 2025/26" },
  { path: "2025-26/fr.1.json", label: "Ligue 1 2025/26" },
  { path: "2025-26/nl.1.json", label: "Eredivisie 2025/26" },
  { path: "2025-26/pt.1.json", label: "Primeira Liga 2025/26" },
  { path: "2025-26/en.2.json", label: "Championship 2025/26" },
  { path: "2025-26/it.2.json", label: "Serie B 2025/26" },
] as const;

export const FOOTBALL_DATA_ORG_COMPETITIONS = ["PL", "SA", "BL1", "PD", "FL1"] as const;

export const CLUBELO_FAILOVER_TEMPLATES = [
  (day: string) => `http://api.clubelo.com/${day}`,
  (day: string) => `https://api.clubelo.com/${day}`,
] as const;

/** Understat public getLeagueData slugs (page XHR, not a WAF bypass). */
export const UNDERSTAT_LEAGUES = [
  { slug: "EPL", label: "Premier League" },
  { slug: "Serie_A", label: "Serie A" },
  { slug: "La_Liga", label: "La Liga" },
  { slug: "Bundesliga", label: "Bundesliga" },
  { slug: "Ligue_1", label: "Ligue 1" },
] as const;

/** Official Open-Meteo ping (documented Emirates coords — API health, not an invented match). */
export const OPEN_METEO_PING_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=51.5549&longitude=-0.1084&current_weather=true";

/** European season start year (July–June). Matches understat-league.europeanSeasonYear. */
export function understatSeasonYear(dayIso: string): number {
  const y = Number(dayIso.slice(0, 4));
  const m = Number(dayIso.slice(5, 7));
  return m >= 7 ? y : y - 1;
}

export const FREE_SOURCE_CATALOG: FreeSourceDef[] = [
  {
    source_id: "clubelo",
    title: "ClubElo",
    title_it: "ClubElo",
    license_class: "public_endpoint",
    kind: "ratings",
    url: "http://api.clubelo.com/",
    rate_limit_ms: 500,
    notes: "Public daily CSV (api.clubelo.com/YYYY-MM-DD). HTTPS + previous-day failover. No fake Elo. Fonti-inactive while live GETs return 502.",
    notes_it: "CSV pubblico giornaliero. Failover HTTPS e giorni precedenti. Nessun Elo inventato. Non in Fonti attive se il fetch live fallisce (HTTP 502).",
    market_layer: false,
    live: true,
    fonti_active: false,
  },
  {
    source_id: "openligadb",
    title: "OpenLigaDB",
    title_it: "OpenLigaDB",
    license_class: "public_endpoint",
    kind: "fixtures",
    url: "https://api.openligadb.de/getmatchdata/bl1",
    rate_limit_ms: 1_000,
    notes: "Free German + verified community comps (BL1/2/3, DFB, Frauen-BL, UCL, Swiss SL, La Liga, PL). No key.",
    notes_it: "API gratuita: Bundesliga, 2.BL, 3.Liga, DFB, Frauen-BL, UCL, Super League CH, La Liga, Premier League. Nessuna chiave.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "thesportsdb",
    title: "TheSportsDB",
    title_it: "TheSportsDB",
    license_class: "public_endpoint",
    kind: "meta",
    url: "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328",
    rate_limit_ms: 1_500,
    notes: "Free test key 3 — EU5 plus Eredivisie, Primeira Liga, Championship, Serie B. CONTEXT meta only.",
    notes_it: "Chiave test gratuita. Campionati europei extra. Solo contesto, non modello indipendente.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "statsbomb",
    title: "StatsBomb Open Data",
    title_it: "StatsBomb Open Data",
    license_class: "dataset",
    kind: "research_dataset",
    url: "https://raw.githubusercontent.com/statsbomb/open-data/master/data/competitions.json",
    rate_limit_ms: 800,
    notes: "Historical open event/xG research packs. Not live. available_at unknown → NOT_ELIGIBLE.",
    notes_it: "Pacchetti storici open. Non e live. available_at sconosciuto: non entra nel modello.",
    market_layer: false,
    live: false,
  },
  {
    source_id: "football-data-org",
    title: "football-data.org",
    title_it: "football-data.org",
    license_class: "official_api",
    kind: "fixtures",
    url: "https://api.football-data.org/v4/matches",
    rate_limit_ms: 7_000,
    notes: "Free tier with FOOTBALL_DATA_ORG_TOKEN (PL,SA,BL1,PD,FL1). AUTH_REQUIRED without token. Not on Fonti unless token is set.",
    notes_it: "Piano gratuito con token. Senza token resta AUTH_REQUIRED e fuori da Fonti attive. Nessun token inventato.",
    market_layer: false,
    live: true,
    fonti_active: false,
    requires_token: "FOOTBALL_DATA_ORG_TOKEN",
  },
  {
    source_id: "football-data-co-uk",
    title: "football-data.co.uk",
    title_it: "football-data.co.uk",
    license_class: "dataset",
    kind: "results",
    url: "https://www.football-data.co.uk/mmz4281/",
    rate_limit_ms: 2_000,
    notes: "Free CSVs E0/E1/I1/I2/SP1/SP2/D1/D2/F1/F2/N1/P1/SC0/B1/T1/G1. Scores DATE_ONLY. Odds columns MARKET/UI only — never MODEL.",
    notes_it: "CSV campionati europei. Risultati DATE_ONLY. Le quote restano layer di mercato/UI.",
    market_layer: false,
    live: false,
  },
  {
    source_id: "ansa",
    title: "ANSA Calcio RSS",
    title_it: "ANSA Calcio RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml",
    rate_limit_ms: 2_000,
    notes: "Public RSS. CONTEXT only; never invents injuries from headlines.",
    notes_it: "RSS pubblico. Solo contesto; nessun infortunio inventato dai titoli.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "bbc-sport",
    title: "BBC Sport Football RSS",
    title_it: "BBC Sport Calcio RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    rate_limit_ms: 2_000,
    notes: "Public BBC football RSS. CONTEXT only.",
    notes_it: "RSS pubblico BBC football. Solo contesto.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "guardian-football",
    title: "The Guardian Football RSS",
    title_it: "The Guardian Football RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.theguardian.com/football/rss",
    rate_limit_ms: 2_000,
    notes: "Public Guardian football RSS. CONTEXT only.",
    notes_it: "RSS pubblico The Guardian. Solo contesto.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "gazzetta",
    title: "Gazzetta dello Sport RSS",
    title_it: "Gazzetta dello Sport RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.gazzetta.it/rss/calcio.xml",
    rate_limit_ms: 2_000,
    notes: "Public Gazzetta calcio RSS. CONTEXT only.",
    notes_it: "RSS pubblico Gazzetta calcio. Solo contesto.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "espn",
    title: "ESPN Scoreboard (unofficial)",
    title_it: "ESPN Scoreboard (non ufficiale)",
    license_class: "public_endpoint",
    kind: "fixtures",
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    rate_limit_ms: 1_000,
    notes: "Unofficial/unstable site JSON. Cached. No CAPTCHA. Not an official ESPN product API. EU5 + UCL/UEL + NL/PT/ENG2/ITA2/BEL/TUR/SCO.",
    notes_it: "JSON pubblico non ufficiale/instabile. In cache. Nessun CAPTCHA. Non e un'API ufficiale. Piu campionati dopo HTTP 200 reale.",
    market_layer: false,
    live: true,
    unofficial: true,
  },
  {
    source_id: "openfootball",
    title: "OpenFootball football.json",
    title_it: "OpenFootball football.json",
    license_class: "dataset",
    kind: "research_dataset",
    url: "https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/en.1.json",
    rate_limit_ms: 800,
    notes: "Public GitHub season JSON. Historical/research. DATE_ONLY. Not live. EU5 + NL/PT/ENG2/ITA2 2025-26.",
    notes_it: "JSON stagionale pubblico su GitHub. Storico/ricerca. DATE_ONLY. Non live. Piu campionati 2025/26.",
    market_layer: false,
    live: false,
  },
  {
    source_id: "api-football",
    title: "API-Football / API-Sports",
    title_it: "API-Football / API-Sports",
    license_class: "official_api",
    kind: "fixtures",
    url: "https://v3.football.api-sports.io/fixtures",
    rate_limit_ms: 7_000,
    notes: "Free tier 100 req/day if API_SPORTS_KEY / API_FOOTBALL_KEY is set. Fixtures + one cached /odds?date= (MARKET/UI). AUTH_REQUIRED otherwise. Not on Fonti without key.",
    notes_it: "Piano free 100 req/giorno con chiave gia in env. Quote solo layer mercato/UI. Senza chiave: fuori da Fonti attive.",
    market_layer: false,
    live: true,
    fonti_active: false,
    requires_token: "API_SPORTS_KEY",
  },
  {
    source_id: "the-odds-api",
    title: "The Odds API",
    title_it: "The Odds API",
    license_class: "official_api",
    kind: "market",
    url: "https://api.the-odds-api.com/v4/sports/soccer_epl/odds",
    rate_limit_ms: 8_000,
    notes: "MARKET/UI layer only if THE_ODDS_API_KEY is set. Never independent MODEL. AUTH_REQUIRED without key. Not on Fonti without key.",
    notes_it: "Solo layer mercato/UI con chiave. Mai modello indipendente. Senza chiave: fuori da Fonti attive.",
    market_layer: true,
    live: true,
    fonti_active: false,
    requires_token: "THE_ODDS_API_KEY",
  },
  {
    source_id: "understat",
    title: "Understat",
    title_it: "Understat",
    license_class: "public_endpoint",
    kind: "research_dataset",
    url: "https://understat.com/getLeagueData/EPL/2026",
    rate_limit_ms: 2_000,
    notes: "Public getLeagueData XHR (X-Requested-With). Rolling L5 xG CONTEXT only; available_at unknown so not MODEL.",
    notes_it: "getLeagueData pubblico (XHR della pagina). xG L5 solo contesto; available_at sconosciuto.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "open-meteo",
    title: "Open-Meteo",
    title_it: "Open-Meteo",
    license_class: "official_api",
    kind: "meta",
    url: OPEN_METEO_PING_URL,
    rate_limit_ms: 1_000,
    notes: "Official forecast/archive API. No key. CONTEXT weather only when stadium coords are known.",
    notes_it: "API ufficiale senza chiave. Meteo CONTEXT solo con coordinate stadio note. Nessuna temperatura inventata.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "sky-sports",
    title: "Sky Sports Football RSS",
    title_it: "Sky Sports Calcio RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.skysports.com/rss/12040",
    rate_limit_ms: 2_000,
    notes: "Public Sky Sports UK football RSS (HTTP 200). CONTEXT only. Italian Sky Sport /rss/calcio.xml is 404 — not listed.",
    notes_it: "RSS pubblico Sky Sports UK. Solo contesto. Il feed italiano Sky Sport non esiste (404): non e in Fonti.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "espn-soccer-news",
    title: "ESPN Soccer News RSS",
    title_it: "ESPN Soccer News RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.espn.com/espn/rss/soccer/news",
    rate_limit_ms: 2_000,
    notes: "Public ESPN soccer news RSS. CONTEXT only; never invents injuries from headlines.",
    notes_it: "RSS pubblico ESPN soccer. Solo contesto; nessun infortunio inventato dai titoli.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "corriere-sport",
    title: "Corriere dello Sport RSS",
    title_it: "Corriere dello Sport RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.corrieredellosport.it/rss/calcio",
    rate_limit_ms: 2_000,
    notes: "Public Corriere dello Sport calcio RSS. CONTEXT only.",
    notes_it: "RSS pubblico Corriere dello Sport. Solo contesto.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "il-messaggero",
    title: "Il Messaggero Sport RSS",
    title_it: "Il Messaggero Sport RSS",
    license_class: "public_endpoint",
    kind: "news",
    url: "https://www.ilmessaggero.it/rss/sport.xml",
    rate_limit_ms: 2_000,
    notes: "Public Il Messaggero sport RSS. CONTEXT only. Replaces empty Tuttosport calcio channel.",
    notes_it: "RSS pubblico Il Messaggero sport. Solo contesto. Il feed Tuttosport calcio e un canale vuoto: non e in Fonti.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "api-sports",
    title: "API-Sports",
    title_it: "API-Sports",
    license_class: "official_api",
    kind: "fixtures",
    url: "https://v3.football.api-sports.io/fixtures",
    rate_limit_ms: 7_000,
    notes: "Same free-tier as API-Football. Not on Fonti without API_SPORTS_KEY. No duplicate fetch when api-football already spends the budget.",
    notes_it: "Stesso piano di API-Football. Senza chiave: fuori da Fonti attive. Nessuna seconda richiesta sul budget free.",
    market_layer: false,
    live: true,
    fonti_active: false,
    requires_token: "API_SPORTS_KEY",
  },
  {
    source_id: "club-football-match-data",
    title: "Club-Football-Match-Data",
    title_it: "Club-Football-Match-Data",
    license_class: "dataset",
    kind: "research_dataset",
    url: "https://github.com/xgabora/Club-Football-Match-Data",
    rate_limit_ms: 0,
    notes: "CACHE_ONLY local clone. DATE_ONLY. Odds columns MARKET/UI only. NO_DATA if clone missing — never invented.",
    notes_it: "Corpus locale CACHE_ONLY. DATE_ONLY. Quote solo mercato/UI. NO_DATA se il clone manca. Nessuna riga inventata.",
    market_layer: false,
    live: false,
  },
];

export function freeSourceById(id: string): FreeSourceDef | undefined {
  return FREE_SOURCE_CATALOG.find((s) => s.source_id === id);
}

export function openLigaMatchUrl(shortcut: string): string {
  return `https://api.openligadb.de/getmatchdata/${shortcut}`;
}

export function theSportsDbNextUrl(leagueId: string): string {
  return `https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${leagueId}`;
}

export function footballDataCoUkCsvUrl(season: string, division: string): string {
  return `https://www.football-data.co.uk/mmz4281/${season}/${division}.csv`;
}

export function espnScoreboardUrl(board: (typeof ESPN_SCOREBOARDS)[number]): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${board.slug}/scoreboard`;
}

function apiSportsTokenPresent(): boolean {
  return tokenEnvPresent("API_SPORTS_KEY") || tokenEnvPresent("API_FOOTBALL_KEY");
}

function shouldDiscoverSource(id: string): boolean {
  const def = freeSourceById(id);
  if (!def) return false;
  if (id === "api-football" || id === "api-sports") return apiSportsTokenPresent();
  if (def.requires_token && !tokenEnvPresent(def.requires_token)) return false;
  return true;
}

export function openFootballUrl(packPath: string): string {
  return `https://raw.githubusercontent.com/openfootball/football.json/master/${packPath}`;
}

export function footballDataOrgMatchesUrl(): string {
  const comps = FOOTBALL_DATA_ORG_COMPETITIONS.join(",");
  return `https://api.football-data.org/v4/matches?competitions=${comps}&status=SCHEDULED`;
}

/** Static URL map used as discovery output (allowlisted hosts only). */
export function discoverFreeSourceJobs(nowIso = new Date().toISOString()): AcquisitionJob[] {
  const day = nowIso.slice(0, 10);
  const season = currentFootballDataSeasonCode(day);
  const jobs: AcquisitionJob[] = [
    {
      source_id: "clubelo",
      kind: "ratings",
      url: `http://api.clubelo.com/${day}`,
      label: `clubelo:${day}`,
    },
    {
      source_id: "sky-sports",
      kind: "news",
      url: "https://www.skysports.com/rss/12040",
      label: "sky-sports:rss",
    },
    {
      source_id: "espn-soccer-news",
      kind: "news",
      url: "https://www.espn.com/espn/rss/soccer/news",
      label: "espn-soccer-news:rss",
    },
    {
      source_id: "corriere-sport",
      kind: "news",
      url: "https://www.corrieredellosport.it/rss/calcio",
      label: "corriere-sport:rss",
    },
    {
      source_id: "il-messaggero",
      kind: "news",
      url: "https://www.ilmessaggero.it/rss/sport.xml",
      label: "il-messaggero:rss",
    },
  ];
  const rest: AcquisitionJob[] = [
    {
      source_id: "openligadb",
      kind: "fixtures",
      url: openLigaMatchUrl("bl1"),
      label: "openligadb:multi",
      league: OPENLIGA_LEAGUES.map((l) => l.shortcut).join(","),
    },
    {
      source_id: "thesportsdb",
      kind: "meta",
      url: theSportsDbNextUrl("4328"),
      label: "thesportsdb:eu5",
      league: THESPORTSDB_LEAGUES.map((l) => l.id).join(","),
    },
    {
      source_id: "statsbomb",
      kind: "research_dataset",
      url: "https://raw.githubusercontent.com/statsbomb/open-data/master/data/competitions.json",
      label: "statsbomb:competitions",
    },
    {
      source_id: "football-data-org",
      kind: "fixtures",
      url: footballDataOrgMatchesUrl(),
      label: "football-data-org:EU5",
      league: FOOTBALL_DATA_ORG_COMPETITIONS.join(","),
    },
    {
      source_id: "football-data-co-uk",
      kind: "results",
      url: footballDataCoUkCsvUrl(season, "E0"),
      label: `football-data-co-uk:${season}/EU5`,
      league: FDOUK_DIVISIONS.map((d) => d.code).join(","),
    },
    {
      source_id: "ansa",
      kind: "news",
      url: "https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml",
      label: "ansa:rss",
    },
    {
      source_id: "bbc-sport",
      kind: "news",
      url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
      label: "bbc-sport:rss",
    },
    {
      source_id: "guardian-football",
      kind: "news",
      url: "https://www.theguardian.com/football/rss",
      label: "guardian-football:rss",
    },
    {
      source_id: "gazzetta",
      kind: "news",
      url: "https://www.gazzetta.it/rss/calcio.xml",
      label: "gazzetta:rss",
    },
    {
      source_id: "espn",
      kind: "fixtures",
      url: espnScoreboardUrl(ESPN_SCOREBOARDS[0]!),
      label: "espn:scoreboard",
      league: ESPN_SCOREBOARDS.map((b) => b.slug).join(","),
    },
    {
      source_id: "openfootball",
      kind: "research_dataset",
      url: openFootballUrl(OPENFOOTBALL_PACKS[0]!.path),
      label: "openfootball:2025-26",
    },
    {
      source_id: "api-football",
      kind: "fixtures",
      url: "https://v3.football.api-sports.io/fixtures?next=15",
      label: "api-football:next15",
    },
    {
      source_id: "the-odds-api",
      kind: "market",
      url: "https://api.the-odds-api.com/v4/sports/soccer_epl/odds",
      label: "the-odds-api:soccer_epl",
      league: "soccer_epl",
    },
    {
      source_id: "understat",
      kind: "research_dataset",
      url: `https://understat.com/getLeagueData/EPL/${understatSeasonYear(day)}`,
      label: `understat:EPL:${understatSeasonYear(day)}`,
      league: "EPL",
    },
    {
      source_id: "open-meteo",
      kind: "meta",
      url: OPEN_METEO_PING_URL,
      label: "open-meteo:forecast-ping",
    },
    {
      source_id: "api-sports",
      kind: "fixtures",
      url: "https://v3.football.api-sports.io/fixtures?next=15",
      label: "api-sports:shared-lane",
    },
    {
      source_id: "club-football-match-data",
      kind: "research_dataset",
      url: "https://github.com/xgabora/Club-Football-Match-Data",
      label: "club-football-match-data:cache",
    },
  ];
  return [...jobs, ...rest].filter((j) => shouldDiscoverSource(j.source_id));
}

/** football-data.co.uk season folder: 2526 for 2025-08 … 2026-07. */
export function currentFootballDataSeasonCode(dayIso: string): string {
  const y = Number(dayIso.slice(0, 4));
  const m = Number(dayIso.slice(5, 7));
  const start = m >= 8 ? y : y - 1;
  const a = String(start).slice(2);
  const b = String(start + 1).slice(2);
  return `${a}${b}`;
}
