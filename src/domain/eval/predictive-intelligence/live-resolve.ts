/**
 * Map live Odds-API events → Football-Data PI universe (division + team ids).
 * No invented history — only resolution against known aliases / imported matches.
 */
import { FOOTBALL_DATA_CO_UK_TEAM_ALIASES } from "@/providers/football-data-co-uk/team-aliases";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";
import type { PiDivision } from "@/domain/eval/predictive-intelligence/config";
import {
  identityKey,
  identitySlug,
  resolveCompetitionMatrix,
} from "@/domain/eval/data-intelligence/research/identity-normalize";

/** Odds API / Lab B competition keys → football-data.co.uk division codes. */
const COMPETITION_TO_DIVISION: Record<string, PiDivision> = {
  soccer_epl: "E0",
  epl: "E0",
  e0: "E0",
  "premier league": "E0",
  "england premier league": "E0",
  "english premier league": "E0",
  soccer_italy_serie_a: "I1",
  serie_a: "I1",
  i1: "I1",
  "serie a": "I1",
  soccer_spain_la_liga: "SP1",
  la_liga: "SP1",
  sp1: "SP1",
  "la liga": "SP1",
  soccer_germany_bundesliga: "D1",
  bundesliga: "D1",
  "1. bundesliga": "D1",
  "1. fußball-bundesliga": "D1",
  "1. fussball-bundesliga": "D1",
  d1: "D1",
  soccer_france_ligue_one: "F1",
  ligue_1: "F1",
  f1: "F1",
  "ligue 1": "F1",
};

/**
 * Extra Odds-API / common English names → same canonical ids as football-data aliases.
 * Keys stored lowercased.
 */
const LIVE_NAME_TO_ID: Record<string, string> = {
  "nottingham forest": "nottingham-forest",
  "nottingham forest fc": "nottingham-forest",
  "nottm forest": "nottingham-forest",
  "nott'm forest": "nottingham-forest",
  "aston villa": "aston-villa",
  "manchester united": "manchester-united",
  "manchester united fc": "manchester-united",
  "man united": "manchester-united",
  "man utd": "manchester-united",
  "as roma": "roma",
  "as roma fc": "roma",
  roma: "roma",
  "manchester city": "manchester-city",
  "man city": "manchester-city",
  "west ham": "west-ham",
  "west ham united": "west-ham",
  "crystal palace": "crystal-palace",
  "sheffield united": "sheffield-united",
  "sheffield utd": "sheffield-united",
  "newcastle united": "newcastle",
  newcastle: "newcastle",
  "brighton and hove albion": "brighton",
  "brighton & hove albion": "brighton",
  brighton: "brighton",
  "wolverhampton wanderers": "wolves",
  wolves: "wolves",
  "tottenham hotspur": "tottenham",
  spurs: "tottenham",
  "leicester city": "leicester",
  "leeds united": "leeds",
  "afc bournemouth": "bournemouth",
  bournemouth: "bournemouth",
  // Serie A / La Liga / Bundesliga / Ligue 1 common Odds names
  "inter milan": "inter",
  inter: "inter",
  "ac milan": "milan",
  "atletico madrid": "ath-madrid",
  "atlético madrid": "ath-madrid",
  "athletic bilbao": "ath-bilbao",
  "athletic club": "ath-bilbao",
  "real madrid": "real-madrid",
  barcelona: "barcelona",
  "bayern munich": "bayern-munich",
  "internazionale": "inter",
  "internazionale milano": "inter",
  "fc internazionale": "inter",
  "bayern munchen": "bayern-munich",
  "fc bayern munich": "bayern-munich",
  "fc bayern munchen": "bayern-munich",
  "sporting cp": "sporting-lisbon",
  "sporting lisbon": "sporting-lisbon",
  "fenerbahce": "fenerbahce",
  "fenerbahce sk": "fenerbahce",
  "bodo glimt": "bodo-glimt",
  "fk bodo glimt": "bodo-glimt",
  "shakhtar donetsk": "shakhtar",
  "psv eindhoven": "psv",
  psv: "psv",
  "rb leipzig": "leipzig",
  leipzig: "leipzig",
  como: "como",
  sabah: "sabah",
  sunderland: "sunderland",
  "sunderland afc": "sunderland",
  "borussia dortmund": "dortmund",
  psg: "paris-sg",
  "paris saint germain": "paris-sg",
  "paris saint-germain": "paris-sg",
  "ca osasuna": "osasuna",
  osasuna: "osasuna",
  "deportivo alaves": "alaves",
  alaves: "alaves",
  "real betis": "betis",
  betis: "betis",
  "celta vigo": "celta-vigo",
  "olympique lyonnais": "lyon",
  lyon: "lyon",
  "stade rennais": "rennes",
  rennes: "rennes",
  "hellas verona": "verona",
  verona: "verona",
  "le havre": "le-havre",
  "ogc nice": "nice",
  "rc lens": "lens",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Build lowercased lookup from published football-data alias table. */
function aliasLookup(): Map<string, string> {
  const m = new Map<string, string>();
  const index = (raw: string, id: string) => {
    m.set(raw.toLowerCase(), id);
    m.set(slugify(raw), id);
    const ident = identitySlug(raw);
    if (ident) m.set(ident, id);
  };
  for (const [raw, id] of Object.entries(FOOTBALL_DATA_CO_UK_TEAM_ALIASES)) {
    index(raw, id);
  }
  for (const [raw, id] of Object.entries(LIVE_NAME_TO_ID)) {
    index(raw, id);
  }
  return m;
}

const ALIAS_LC = aliasLookup();

export function mapCompetitionToPiDivision(competition?: string | null): PiDivision | null {
  if (!competition) return null;
  const k = competition.trim().toLowerCase().replace(/\s+/g, "_");
  if (COMPETITION_TO_DIVISION[k]) return COMPETITION_TO_DIVISION[k]!;
  const compact = competition.trim().toLowerCase();
  if (COMPETITION_TO_DIVISION[compact]) return COMPETITION_TO_DIVISION[compact]!;
  const matrix = resolveCompetitionMatrix(competition);
  if (matrix.canonical_code === "E0" || matrix.canonical_code === "SP1" || matrix.canonical_code === "D1" || matrix.canonical_code === "I1" || matrix.canonical_code === "F1") {
    return matrix.canonical_code;
  }
  const up = competition.trim().toUpperCase();
  if (up === "E0" || up === "SP1" || up === "D1" || up === "I1" || up === "F1") {
    return up as PiDivision;
  }
  return null;
}

/**
 * Resolve Odds/live team display name to PI home_team_id / away_team_id.
 * Prefers alias table, then exact id presence in matches, then slug equality.
 */
function datasetTeamId(
  matches: readonly PiMatchRow[],
  needles: string[],
): string | null {
  const want = new Set(
    needles
      .filter(Boolean)
      .map((n) => n.toLowerCase())
      .flatMap((n) => (n.startsWith("raw:") ? [n, n.slice(4)] : [n, `raw:${n}`])),
  );
  for (const m of matches) {
    for (const [id, name] of [
      [m.home_team_id, m.home_team],
      [m.away_team_id, m.away_team],
    ] as const) {
      const idLc = id.toLowerCase();
      const stripped = idLc.startsWith("raw:") ? idLc.slice(4) : idLc;
      if (want.has(idLc) || want.has(stripped) || want.has(name.toLowerCase())) {
        return id;
      }
    }
  }
  return null;
}

export function resolveLiveTeamId(
  rawName: string | null | undefined,
  matches: readonly PiMatchRow[],
): { team_id: string; matched: boolean; method: string } {
  const raw = (rawName ?? "").trim();
  if (!raw) return { team_id: "live:unknown", matched: false, method: "empty" };

  const lc = raw.toLowerCase();
  const slug = slugify(raw);
  const ident = identitySlug(raw);
  const fromAlias = ALIAS_LC.get(lc) ?? ALIAS_LC.get(slug) ?? (ident ? ALIAS_LC.get(ident) : undefined);

  const hit = datasetTeamId(matches, [fromAlias ?? "", ident, slug, lc, identityKey(raw)]);
  if (hit) {
    return {
      team_id: hit,
      matched: true,
      method: fromAlias ? "alias_dataset" : "dataset_id",
    };
  }
  if (fromAlias) {
    return { team_id: fromAlias, matched: true, method: "alias_unverified" };
  }

  return { team_id: `live:${slug || lc}`, matched: false, method: "unresolved" };
}

/** Latest season code present in matches for a division (e.g. "2324"). */
export function latestSeasonForDivision(
  matches: readonly PiMatchRow[],
  division: string,
): string | null {
  let best: string | null = null;
  for (const m of matches) {
    if (m.league !== division) continue;
    if (!best || m.season > best) best = m.season;
  }
  return best;
}

export type LivePiTargetMeta = {
  division: string | null;
  season: string;
  home_team_id: string;
  away_team_id: string;
  home_matched: boolean;
  away_matched: boolean;
  home_method: string;
  away_method: string;
};

export function resolveLivePiTarget(input: {
  home_team?: string | null;
  away_team?: string | null;
  competition?: string | null;
  matches: readonly PiMatchRow[];
}): LivePiTargetMeta {
  const division = mapCompetitionToPiDivision(input.competition);
  const scoped = division ? input.matches.filter((m) => m.league === division) : input.matches;
  const home = resolveLiveTeamId(input.home_team, scoped.length ? scoped : input.matches);
  const away = resolveLiveTeamId(input.away_team, scoped.length ? scoped : input.matches);
  const season =
    (division ? latestSeasonForDivision(input.matches, division) : null) ?? "live";
  return {
    division,
    season,
    home_team_id: home.team_id,
    away_team_id: away.team_id,
    home_matched: home.matched,
    away_matched: away.matched,
    home_method: home.method,
    away_method: away.method,
  };
}
