/**
 * TEAM_MATCHING — abbina i nomi squadra fra fonti diverse, o rifiuta.
 *
 * Il calendario arriva da football-data.org ("Borussia Monchengladbach",
 * "1. FC Koln", "Bologna FC 1909"); lo storico che alimenta il modello usa la
 * grafia di Football-Data.co.uk ("M'gladbach", "FC Koln", "Bologna").
 *
 * Il rischio non e non trovare un abbinamento: e trovarne uno sbagliato. Una
 * previsione sulla squadra sbagliata e indistinguibile da una giusta finche non
 * si perde. Quindi questo modulo NON restituisce mai il candidato "piu vicino":
 * pretende un punteggio alto E un margine netto sul secondo, altrimenti
 * dichiara AMBIGUOUS o NO_MATCH e la partita esce dal tabellone.
 */

const NOISE_TOKENS = new Set([
  "fc", "afc", "cf", "sc", "sv", "ac", "as", "ca", "cd", "ud", "rc", "rcd", "ssc",
  "us", "usl", "aj", "ogc", "losc", "psg", "tsg", "vfl", "vfb", "bsc", "fsv", "spvgg",
  "club", "calcio", "futbol", "football", "futebol",
  "de", "di", "the", "and", "y", "e",
]);
// "real", "atletico", "athletic", "sporting", "deportivo" NON sono rumore: in
// Spagna e Portogallo distinguono societa diverse della stessa citta. Trattarli
// come rumore rendeva "Real Madrid" indistinguibile da "Rayo Vallecano de Madrid".

/**
 * Casi che la somiglianza non puo risolvere da sola, perche due societa della
 * stessa citta condividono la parte discriminante dopo la normalizzazione.
 * Tabella esplicita e verificabile: consultata PRIMA del confronto fuzzy.
 */
export const EXPLICIT_ALIASES: Record<string, string> = {
  "club atletico de madrid": "Ath Madrid",
  "atletico madrid": "Ath Madrid",
  "athletic club": "Ath Bilbao",
  "real sociedad de futbol": "Sociedad",
  "rcd espanyol de barcelona": "Espanol",
  "rc celta de vigo": "Celta",
  "villarreal cf": "Villarreal",
  "sevilla fc": "Sevilla",
  "real betis balompie": "Betis",
  "fc internazionale milano": "Inter",
  "ac milan": "Milan",
  "as roma": "Roma",
  "ssc napoli": "Napoli",
  "juventus fc": "Juventus",
  "acf fiorentina": "Fiorentina",
  "fc bayern munchen": "Bayern Munich",
  "borussia dortmund": "Dortmund",
  "bayer 04 leverkusen": "Leverkusen",
  "rb leipzig": "RB Leipzig",
  "vfb stuttgart": "Stuttgart",
  "paris saint germain": "Paris SG",
  "olympique de marseille": "Marseille",
  "olympique lyonnais": "Lyon",
  "wolverhampton wanderers fc": "Wolves",
  "nottingham forest fc": "Nott'm Forest",
  "manchester city fc": "Man City",
  "manchester united fc": "Man United",
  "newcastle united fc": "Newcastle",
  "brighton hove albion fc": "Brighton",
  "afc bournemouth": "Bournemouth",
  "west ham united fc": "West Ham",
  "sheffield wednesday fc": "Sheffield Weds",
  "sporting clube de braga": "Sp Braga",
  "sporting clube de portugal": "Sp Lisbon",
  "west bromwich albion fc": "West Brom",
  "queens parkangers fc": "QPR",
  "queens park rangers fc": "QPR",
  "preston north end fc": "Preston",
  "hull city afc": "Hull",
  "swansea city afc": "Swansea",
  "go ahead eagles": "Go Ahead Eagles",
  "tsg 1899 hoffenheim": "Hoffenheim",
  "fc schalke 04": "Schalke 04",
  "rc deportivo la coruna": "La Coruna",
  "fc twente 65": "Twente",
  "psv": "PSV Eindhoven",
  "stade rennais 1901": "Rennes",
  "stade rennais": "Rennes",
  "stade brestois 29": "Brest",
  "rc strasbourg alsace": "Strasbourg",
  "paris": "Paris SG",
  "olympique lyonnais": "Lyon",
  "ogc nice": "Nice",
  "cs maritimo": "Maritimo",
  "vitoria sc": "Guimaraes",
  "rio ave": "Rio Ave",
  "nec": "NEC Nijmegen",
};

/** Alias indicizzati sulla forma normalizzata: cosi "Paris Saint-Germain FC",
 *  "Paris Saint-Germain" e "PSG" cadono tutti sulla stessa chiave. */
let ALIAS_INDEX: Map<string, string> | null = null;
function aliasIndex(): Map<string, string> {
  if (ALIAS_INDEX) return ALIAS_INDEX;
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(EXPLICIT_ALIASES)) {
    m.set(normalizeTeamName(k).normalized, v);
  }
  ALIAS_INDEX = m;
  return m;
}

/** Toglie accenti, punteggiatura, numeri e sigle societarie. */
export function normalizeTeamName(raw: string): { normalized: string; tokens: string[] } {
  const base = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = base
    .split(" ")
    .filter((t) => t.length > 0)
    .filter((t) => !/^\d+$/.test(t))
    .filter((t) => !NOISE_TOKENS.has(t));
  const kept = tokens.length ? tokens : base.split(" ").filter(Boolean);
  return { normalized: kept.join(""), tokens: kept };
}

/** Lunghezza della piu lunga sottostringa comune. */
export function longestCommonSubstring(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i += 1) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1]! + 1;
        if (cur[j]! > best) best = cur[j]!;
      }
    }
    prev = cur;
  }
  return best;
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * 0..1. Base: sottostringa comune piu lunga rapportata al nome piu corto, perche
 * una fonte abbrevia ("M'gladbach" dentro "Borussia Monchengladbach"). La
 * sovrapposizione di token puo solo ALZARE il punteggio: pesarla in media lo
 * abbassava proprio sugli abbreviati, che sono i casi da riconoscere.
 */
export function similarity(a: string, b: string): number {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na.normalized || !nb.normalized) return 0;
  if (na.normalized === nb.normalized) return 1;
  const lcs = longestCommonSubstring(na.normalized, nb.normalized);
  const shorter = Math.min(na.normalized.length, nb.normalized.length);
  if (shorter < 4) return 0;
  const sub = lcs / shorter;
  const jac = jaccard(na.tokens, nb.tokens);
  return Math.min(1, sub + 0.15 * jac);
}

export type MatchOutcome =
  | { status: "MATCHED"; candidate: string; score: number; runnerUp: string | null; margin: number }
  | { status: "AMBIGUOUS"; candidates: string[]; score: number; margin: number }
  | { status: "NO_MATCH"; best: string | null; score: number };

export const MATCH_MIN_SCORE = 0.75;
export const MATCH_MIN_MARGIN = 0.12;

export function matchTeam(
  query: string,
  candidates: readonly string[],
  opts?: { minScore?: number; minMargin?: number },
): MatchOutcome {
  const alias = aliasIndex().get(normalizeTeamName(query).normalized);
  if (alias && candidates.includes(alias)) {
    return { status: "MATCHED", candidate: alias, score: 1, runnerUp: null, margin: 1 };
  }

  const minScore = opts?.minScore ?? MATCH_MIN_SCORE;
  const minMargin = opts?.minMargin ?? MATCH_MIN_MARGIN;
  const scored = candidates
    .map((c) => ({ c, s: similarity(query, c) }))
    .sort((x, y) => y.s - x.s);
  if (!scored.length) return { status: "NO_MATCH", best: null, score: 0 };

  const top = scored[0]!;
  const second = scored[1] ?? null;
  const margin = second ? top.s - second.s : 1;

  if (top.s < minScore) return { status: "NO_MATCH", best: top.c, score: top.s };
  if (margin < minMargin) {
    return {
      status: "AMBIGUOUS",
      candidates: scored.filter((x) => top.s - x.s < minMargin).map((x) => x.c),
      score: top.s,
      margin,
    };
  }
  return { status: "MATCHED", candidate: top.c, score: top.s, runnerUp: second?.c ?? null, margin };
}

/** Codici competizione football-data.org -> divisioni Football-Data.co.uk. */
export const COMPETITION_TO_DIVISION: Record<string, string> = {
  PL: "E0", ELC: "E1", PD: "SP1", SA: "I1", BL1: "D1",
  FL1: "F1", DED: "N1", PPL: "P1",
};
