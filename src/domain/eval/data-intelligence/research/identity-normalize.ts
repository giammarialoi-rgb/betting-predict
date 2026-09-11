/**
 * Team / competition name normalization. Never invents provider IDs.
 */

const STRIP_TOKENS = new Set([
  "fc",
  "afc",
  "cf",
  "sc",
  "ac",
  "as",
  "ss",
  "us",
  "ud",
  "club",
  "de",
  "the",
  "calcio",
  "football",
  "futbol",
  "ogc",
  "losc",
  "rcd",
  "vfl",
  "vfb",
  "tsg",
  "fsv",
  "ssc",
  "sd",
]);

/**
 * Single-token stems that collide across clubs. Never used as a unique bind
 * unless the query already folds to a longer declared identity key.
 */
const COLLISION_STEMS = new Set([
  "villa",
  "united",
  "city",
  "real",
  "sporting",
  "athletic",
  "rangers",
  "wanderers",
  "olympic",
  "olympique",
  "hotspur",
  "albion",
  "rovers",
  "deportivo",
  "racing",
  "paris",
  "saint",
  "forest",
  "athletic",
]);

const SYNONYMS: Record<string, string> = {
  utd: "united",
  man: "manchester",
  "man utd": "manchester united",
  "man united": "manchester united",
  "manchester utd": "manchester united",
  "man city": "manchester city",
  spurs: "tottenham",
  "tottenham hotspur": "tottenham",
  "inter milan": "internazionale",
  inter: "internazionale",
  "internazionale milano": "internazionale",
  "fc internazionale": "internazionale",
  "ac milan": "milan",
  "as roma": "roma",
  "as roma fc": "roma",
  "bayern munchen": "bayern munich",
  "fc bayern munchen": "bayern munich",
  "fc bayern munich": "bayern munich",
  "bayern munich": "bayern munich",
  psg: "paris saint germain",
  "paris sg": "paris saint germain",
  "paris saint germain": "paris saint germain",
  "nott'm forest": "nottingham forest",
  "nottm forest": "nottingham forest",
  "nott forest": "nottingham forest",
  "notts forest": "nottingham forest",
  "athletic club": "athletic bilbao",
  "ath bilbao": "athletic bilbao",
  "athletic bilbao": "athletic bilbao",
  "ath madrid": "atletico madrid",
  "atletico de madrid": "atletico madrid",
  "atletico madrid": "atletico madrid",
  "sporting cp": "sporting lisbon",
  "sporting lisboa": "sporting lisbon",
  "sporting lisbon": "sporting lisbon",
  "bodo glimt": "bodo glimt",
  "fk bodo glimt": "bodo glimt",
  "shakhtar donetsk": "shakhtar",
  "fc shakhtar": "shakhtar",
  "rb leipzig": "leipzig",
  "rasenballsport leipzig": "leipzig",
  "psv eindhoven": "psv",
  fenerbahce: "fenerbahce",
  "fenerbahce sk": "fenerbahce",
  // EPL Odds / Understat / football-data short forms
  wolves: "wolverhampton",
  "wolverhampton wanderers": "wolverhampton",
  "leeds united": "leeds",
  "leicester city": "leicester",
  "brighton and hove albion": "brighton",
  "brighton hove albion": "brighton",
  "west ham united": "west ham",
  "newcastle united": "newcastle",
  "sheffield united": "sheffield united",
  "sheffield utd": "sheffield united",
  "afc bournemouth": "bournemouth",
  "nottingham forest": "nottingham forest",
  "aston villa": "aston villa",
  // La Liga
  "ca osasuna": "osasuna",
  "club atletico osasuna": "osasuna",
  "deportivo alaves": "alaves",
  "alaves": "alaves",
  "celta vigo": "celta vigo",
  "celta de vigo": "celta vigo",
  "rc celta": "celta vigo",
  "real betis": "betis",
  betis: "betis",
  "rayo vallecano": "rayo vallecano",
  "real sociedad": "real sociedad",
  "girona fc": "girona",
  "valencia cf": "valencia",
  "sevilla fc": "sevilla",
  "villarreal cf": "villarreal",
  "rcd espanyol": "espanyol",
  espanyol: "espanyol",
  "rcd mallorca": "mallorca",
  "ud las palmas": "las palmas",
  "getafe cf": "getafe",
  // Serie A
  "hellas verona": "verona",
  "hellas verona fc": "verona",
  verona: "verona",
  "ssc napoli": "napoli",
  "acf fiorentina": "fiorentina",
  "juventus fc": "juventus",
  "torino fc": "torino",
  "genoa cfc": "genoa",
  "como 1907": "como",
  // Ligue 1 Odds / Understat
  "olympique lyonnais": "lyon",
  "olympique lyon": "lyon",
  lyon: "lyon",
  "olympique marseille": "marseille",
  "olympique de marseille": "marseille",
  marseille: "marseille",
  "stade rennais": "rennes",
  "stade rennes": "rennes",
  rennes: "rennes",
  "rc lens": "lens",
  lens: "lens",
  "ogc nice": "nice",
  nice: "nice",
  "losc lille": "lille",
  "lille osc": "lille",
  lille: "lille",
  "as monaco": "monaco",
  monaco: "monaco",
  "le havre ac": "le havre",
  "le havre": "le havre",
  "angers sco": "angers",
  angers: "angers",
  "rc strasbourg": "strasbourg",
  "racing strasbourg": "strasbourg",
  "strasbourg alsace": "strasbourg",
  "fc nantes": "nantes",
  "toulouse fc": "toulouse",
  "aj auxerre": "auxerre",
  "as saint etienne": "saint etienne",
  "st etienne": "saint etienne",
  "saint etienne": "saint etienne",
  "paris fc": "paris fc",
  // Bundesliga Odds / Understat
  "borussia dortmund": "dortmund",
  dortmund: "dortmund",
  "bayer leverkusen": "leverkusen",
  "bayer 04 leverkusen": "leverkusen",
  leverkusen: "leverkusen",
  "eintracht frankfurt": "frankfurt",
  frankfurt: "frankfurt",
  "borussia monchengladbach": "monchengladbach",
  "borussia mgladbach": "monchengladbach",
  "borussia m gladbach": "monchengladbach",
  "m gladbach": "monchengladbach",
  mgladbach: "monchengladbach",
  gladbach: "monchengladbach",
  "1 fc koln": "koln",
  "fc koln": "koln",
  koln: "koln",
  cologne: "koln",
  "fc cologne": "koln",
  "1 fc union berlin": "union berlin",
  "union berlin": "union berlin",
  "mainz 05": "mainz",
  "fsv mainz 05": "mainz",
  mainz: "mainz",
  "fc st pauli": "st pauli",
  "st pauli": "st pauli",
  "1 fc heidenheim": "heidenheim",
  heidenheim: "heidenheim",
  "tsg hoffenheim": "hoffenheim",
  hoffenheim: "hoffenheim",
  "vfl wolfsburg": "wolfsburg",
  wolfsburg: "wolfsburg",
  "vfb stuttgart": "stuttgart",
  stuttgart: "stuttgart",
  "sv werder bremen": "werder bremen",
  "werder bremen": "werder bremen",
  "sc freiburg": "freiburg",
  freiburg: "freiburg",
  "fc augsburg": "augsburg",
  augsburg: "augsburg",
};

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTeamName(raw: string): string {
  let s = stripAccents(String(raw ?? "").trim().toLowerCase());
  s = s.replace(/&/g, " and ");
  s = s.replace(/[.'`]/g, "");
  s = s.replace(/\b(f\.?\s*c\.?)\b/g, " ");
  s = s.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (SYNONYMS[s]) s = SYNONYMS[s]!;
  const parts = s.split(" ").filter((p) => p && !STRIP_TOKENS.has(p));
  const joined = parts.join(" ").trim();
  if (SYNONYMS[joined]) return SYNONYMS[joined]!;
  return joined || s;
}

export function teamTokens(raw: string): string[] {
  return normalizeTeamName(raw)
    .split(" ")
    .filter((t) => t.length >= 3);
}

/** Canonical identity key after alias fold. Empty string if the name is blank. */
export function identityKey(raw: string): string {
  return normalizeTeamName(raw);
}

export function identitySlug(raw: string): string {
  return identityKey(raw).replace(/\s+/g, "-");
}

export function isCollisionStem(key: string): boolean {
  const k = String(key ?? "").trim().toLowerCase();
  if (!k) return false;
  if (COLLISION_STEMS.has(k)) return true;
  const parts = k.split(" ").filter(Boolean);
  return parts.length === 1 && COLLISION_STEMS.has(parts[0]!);
}

/**
 * Exact identity-key equality after declared aliases.
 * No substring / token-subset guessing — short names like "Villa" do not bind.
 */
export function namesEqual(a: string, b: string): boolean {
  const na = identityKey(a);
  const nb = identityKey(b);
  return Boolean(na && nb && na === nb);
}

export type CompetitionIdentity = {
  source_name: string;
  canonical_code: string | null;
  api_sports_league_id: number | null;
  understat_slug: string | null;
  fbref_comp_id: string | null;
  confidence: "HIGH" | "MEDIUM" | "PROVISIONAL";
};

const COMPETITIONS: Array<{
  keys: string[];
  code: string | null;
  api: number | null;
  understat: string | null;
  fbref: string | null;
}> = [
  {
    keys: ["soccer_epl", "epl", "e0", "premier league", "england premier league", "english premier league"],
    code: "E0",
    api: 39,
    understat: "EPL",
    fbref: "9",
  },
  {
    keys: ["soccer_efl_champ", "championship", "e1", "england championship"],
    code: "E1",
    api: 40,
    understat: null,
    fbref: "10",
  },
  {
    keys: ["soccer_italy_serie_a", "serie_a", "serie a", "i1", "italy serie a"],
    code: "I1",
    api: 135,
    understat: "Serie_A",
    fbref: "11",
  },
  {
    keys: ["soccer_spain_la_liga", "la_liga", "la liga", "sp1", "primera division"],
    code: "SP1",
    api: 140,
    understat: "La_liga",
    fbref: "12",
  },
  {
    keys: ["soccer_germany_bundesliga", "bundesliga", "d1", "germany bundesliga"],
    code: "D1",
    api: 78,
    understat: "Bundesliga",
    fbref: "20",
  },
  {
    keys: ["soccer_france_ligue_one", "ligue_1", "ligue 1", "f1", "france ligue 1"],
    code: "F1",
    api: 61,
    understat: "Ligue_1",
    fbref: "13",
  },
  {
    keys: ["soccer_uefa_champs_league", "uefa champions league", "champions league", "ucl"],
    code: null,
    api: 2,
    understat: null,
    fbref: "8",
  },
  {
    keys: ["soccer_uefa_europa_league", "uefa europa league", "europa league"],
    code: null,
    api: 3,
    understat: null,
    fbref: "19",
  },
  {
    keys: [
      "soccer_uefa_europa_conference_league",
      "uefa europa conference league",
      "conference league",
    ],
    code: null,
    api: 848,
    understat: null,
    fbref: "882",
  },
  {
    keys: ["soccer_netherlands_eredivisie", "eredivisie"],
    code: null,
    api: 88,
    understat: null,
    fbref: "23",
  },
  {
    keys: ["soccer_portugal_primeira_liga", "primeira liga", "liga portugal"],
    code: null,
    api: 94,
    understat: null,
    fbref: "32",
  },
  {
    keys: ["soccer_turkey_super_league", "super lig", "super league turkey"],
    code: null,
    api: 203,
    understat: null,
    fbref: "26",
  },
];

function compactComp(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCompetitionMatrix(name: string | null | undefined): CompetitionIdentity {
  const source_name = String(name ?? "").trim();
  if (!source_name) {
    return {
      source_name: "",
      canonical_code: null,
      api_sports_league_id: null,
      understat_slug: null,
      fbref_comp_id: null,
      confidence: "PROVISIONAL",
    };
  }
  const compact = compactComp(source_name);
  const underscored = compact.replace(/\s+/g, "_");
  const lc = source_name.toLowerCase();
  for (const row of COMPETITIONS) {
    if (row.keys.includes(compact) || row.keys.includes(underscored) || row.keys.includes(lc)) {
      return {
        source_name,
        canonical_code: row.code,
        api_sports_league_id: row.api,
        understat_slug: row.understat,
        fbref_comp_id: row.fbref,
        confidence: row.code || row.api ? "HIGH" : "MEDIUM",
      };
    }
  }
  // Unique whole-phrase containment only. Loose `includes("league")` is forbidden.
  const phraseHits: typeof COMPETITIONS = [];
  for (const row of COMPETITIONS) {
    const hit = row.keys.some((k) => {
      if (k.length < 5) return false;
      const padded = ` ${compact} `;
      return padded.includes(` ${k} `);
    });
    if (hit) phraseHits.push(row);
  }
  if (phraseHits.length === 1) {
    const row = phraseHits[0]!;
    return {
      source_name,
      canonical_code: row.code,
      api_sports_league_id: row.api,
      understat_slug: row.understat,
      fbref_comp_id: row.fbref,
      confidence: "MEDIUM",
    };
  }
  return {
    source_name,
    canonical_code: null,
    api_sports_league_id: null,
    understat_slug: null,
    fbref_comp_id: null,
    confidence: "PROVISIONAL",
  };
}

/** European season start year from a kickoff ISO. */
export function europeanSeasonYear(kickoffIso: string | null | undefined): number {
  const t = kickoffIso ? Date.parse(kickoffIso) : Date.now();
  const d = new Date(Number.isFinite(t) ? t : Date.now());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return m >= 6 ? y : y - 1;
}
