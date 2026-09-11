/**
 * Known free endpoints. Discovery maps these URLs; no CAPTCHA/WAF bypass.
 * Tavily/Context may add candidates later — they never replace this allowlist.
 */
import type { AcquisitionJob, AcquisitionKind } from "@/domain/eval/acquisition-engine/types";
import type { LicenseClass } from "@/domain/alignment-ids";

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

export const FREE_SOURCE_CATALOG: FreeSourceDef[] = [
  {
    source_id: "clubelo",
    title: "ClubElo",
    title_it: "ClubElo",
    license_class: "public_endpoint",
    kind: "ratings",
    url: "http://api.clubelo.com/",
    rate_limit_ms: 500,
    notes: "Public daily CSV (api.clubelo.com/YYYY-MM-DD). Cached locally. rating From < kickoff.",
    notes_it: "CSV pubblico giornaliero. Cache locale. Rating valida solo se From < calcio d'inizio.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "openligadb",
    title: "OpenLigaDB",
    title_it: "OpenLigaDB",
    license_class: "public_endpoint",
    kind: "fixtures",
    url: "https://api.openligadb.de/getmatchdata/bl1",
    rate_limit_ms: 1_000,
    notes: "Free German football API (Bundesliga current round). No key.",
    notes_it: "API gratuita del calcio tedesco (Bundesliga). Nessuna chiave.",
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
    notes: "Free test key 3 — upcoming league events / badges. CONTEXT meta only.",
    notes_it: "Chiave test gratuita. Eventi e stemmi. Solo contesto, non modello indipendente.",
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
    notes: "Historical open event/xG research. Not live. available_at unknown → NOT_ELIGIBLE.",
    notes_it: "Dataset storico di eventi/xG. Non e live. available_at sconosciuto: non entra nel modello.",
    market_layer: false,
    live: false,
  },
  {
    source_id: "football-data-org",
    title: "football-data.org",
    title_it: "football-data.org",
    license_class: "official_api",
    kind: "fixtures",
    url: "https://api.football-data.org/v4/competitions/PL/matches",
    rate_limit_ms: 7_000,
    notes: "Free tier with FOOTBALL_DATA_ORG_TOKEN. Rate-limited. Skip honestly if token missing.",
    notes_it: "Piano gratuito con token. Rate limit. Se manca il token, la fonte resta AUTH_REQUIRED.",
    market_layer: false,
    live: true,
  },
  {
    source_id: "football-data-co-uk",
    title: "football-data.co.uk",
    title_it: "football-data.co.uk",
    license_class: "dataset",
    kind: "results",
    url: "https://www.football-data.co.uk/mmz4281/",
    rate_limit_ms: 2_000,
    notes: "Historical CSV. Scores DATE_ONLY. Odds columns are MARKET layer only — never MODEL.",
    notes_it: "CSV storico. Risultati DATE_ONLY. Le quote restano layer di mercato, mai modello indipendente.",
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
];

export function freeSourceById(id: string): FreeSourceDef | undefined {
  return FREE_SOURCE_CATALOG.find((s) => s.source_id === id);
}

/** Static URL map used as discovery output (allowlisted hosts only). */
export function discoverFreeSourceJobs(nowIso = new Date().toISOString()): AcquisitionJob[] {
  const day = nowIso.slice(0, 10);
  const season = currentFootballDataSeasonCode(day);
  return [
    {
      source_id: "clubelo",
      kind: "ratings",
      url: `http://api.clubelo.com/${day}`,
      label: `clubelo:${day}`,
    },
    {
      source_id: "openligadb",
      kind: "fixtures",
      url: "https://api.openligadb.de/getmatchdata/bl1",
      label: "openligadb:bl1",
      league: "bl1",
    },
    {
      source_id: "thesportsdb",
      kind: "meta",
      url: "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328",
      label: "thesportsdb:epl",
      league: "4328",
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
      url: "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED",
      label: "football-data-org:PL",
      league: "PL",
    },
    {
      source_id: "football-data-co-uk",
      kind: "results",
      url: `https://www.football-data.co.uk/mmz4281/${season}/E0.csv`,
      label: `football-data-co-uk:${season}/E0`,
      league: "E0",
    },
    {
      source_id: "ansa",
      kind: "news",
      url: "https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml",
      label: "ansa:rss",
    },
  ];
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
