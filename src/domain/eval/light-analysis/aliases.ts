/**
 * Light-only club matching for historical frequency rows.
 *
 * Strong / acquisition identity stays fail-closed (`namesEqual` / `matchTeamNames`).
 * Those paths must not use this module — a wrong bind there attaches the wrong
 * event to the wrong club.
 *
 * Light may be looser because it only decides which already-parsed finished
 * matches count toward a board club's empirical frequencies. It never invents
 * goals or corners.
 *
 * Order:
 *  1. Declared identity aliases (Man United = Manchester United, Inter = Internazionale).
 *  2. Dedicated LIGHT_ALIASES for common ESPN / OpenLiga / board vs football-data.co.uk labels.
 *  3. Normalized contains when the shorter key is ≥ LIGHT_CONTAINS_MIN_LEN and is not a
 *     collision stem (Villa, United, City, Real, Sporting, … stay blocked).
 */
import {
  identityKey,
  isCollisionStem,
  namesEqual,
  normalizeTeamName,
} from "@/domain/eval/data-intelligence/research/identity-normalize";

/** Extra folds used only by light history matching. Keys are already identity-normalized. */
export const LIGHT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "ein frankfurt": "frankfurt",
  "eintracht frankfurt": "frankfurt",
  "schalke 04": "schalke",
  schalke: "schalke",
  "fc schalke 04": "schalke",
  "1 union berlin": "union berlin",
  "union berlin": "union berlin",
  "sheff utd": "sheffield united",
  "sheffield utd": "sheffield united",
  "qpr": "queens park rangers",
  "queens park rangers": "queens park rangers",
  "west brom": "west bromwich",
  "west bromwich albion": "west bromwich",
  "west bromwich": "west bromwich",
  "notts county": "notts county",
  magdeburg: "magdeburg",
  "st pauli": "st pauli",
  "fc st pauli": "st pauli",
  "hamburg": "hamburg",
  "hamburger sv": "hamburg",
  hsv: "hamburg",
  "werder": "werder bremen",
  "spal": "spal",
  "hellas": "verona",
  "verona": "verona",
  "udinese": "udinese",
  "udinese calcio": "udinese",
  "cagliari": "cagliari",
  "cagliari calcio": "cagliari",
  "lecce": "lecce",
  "us lecce": "lecce",
  "sassuolo": "sassuolo",
  "us sassuolo": "sassuolo",
  "parma": "parma",
  "parma calcio": "parma",
  "cremonese": "cremonese",
  "us cremonese": "cremonese",
  "pisa": "pisa",
  "pisa sc": "pisa",
  "venezia": "venezia",
  "venezia fc": "venezia",
  "empoli": "empoli",
  "empoli fc": "empoli",
  "monza": "monza",
  "ac monza": "monza",
  "spezia": "spezia",
  "gimnastic": "gimnastic",
  "real oviedo": "oviedo",
  oviedo: "oviedo",
  "levante": "levante",
  "elche": "elche",
  "elche cf": "elche",
  "espanyol": "espanyol",
  "alaves": "alaves",
  "deportivo alaves": "alaves",
  "rayo": "rayo vallecano",
  "rayo vallecano": "rayo vallecano",
  "las palmas": "las palmas",
  "celta": "celta vigo",
  "celta vigo": "celta vigo",
  "betis": "betis",
  "real betis": "betis",
  "sociedad": "real sociedad",
  "real sociedad": "real sociedad",
  "vallecano": "rayo vallecano",
  "braga": "braga",
  "sporting braga": "braga",
  "sc braga": "braga",
  "benfica": "benfica",
  "sl benfica": "benfica",
  porto: "porto",
  "fc porto": "porto",
  "ajax": "ajax",
  "afc ajax": "ajax",
  feyenoord: "feyenoord",
  "az alkmaar": "az alkmaar",
  alkmaar: "az alkmaar",
  "willem ii": "willem ii",
  "twente": "twente",
  "fc twente": "twente",
  "utrecht": "utrecht",
  "fc utrecht": "utrecht",
  "anderlecht": "anderlecht",
  "club brugge": "club brugge",
  "genk": "genk",
  "standard": "standard liege",
  "standard liege": "standard liege",
  "celtic": "celtic",
  "rangers": "rangers",
  "hearts": "hearts",
  "heart of midlothian": "hearts",
  "hibernian": "hibernian",
  "aberdeen": "aberdeen",
  "st mirren": "st mirren",
  "motherwell": "motherwell",
  "dundee utd": "dundee united",
  "dundee united": "dundee united",
  "kilmarnock": "kilmarnock",
  "gaziantep": "gaziantep",
  "trabzonspor": "trabzonspor",
  "besiktas": "besiktas",
  "galatasaray": "galatasaray",
  "fenerbahce": "fenerbahce",
  "olympiacos": "olympiacos",
  "paok": "paok",
  "aek": "aek athens",
  "aek athens": "aek athens",
  "panathinaikos": "panathinaikos",
});

export const LIGHT_CONTAINS_MIN_LEN = 5;

export function lightIdentityKey(raw: string): string {
  const base = identityKey(raw);
  if (!base) return "";
  return LIGHT_ALIASES[base] ?? base;
}

/**
 * True when two club labels should share light history.
 * Collision stems never match via contains.
 */
export function lightNamesMatch(a: string, b: string): boolean {
  if (namesEqual(a, b)) return true;
  const ka = lightIdentityKey(a);
  const kb = lightIdentityKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (isCollisionStem(ka) || isCollisionStem(kb)) return false;
  const shorter = ka.length <= kb.length ? ka : kb;
  const longer = ka.length <= kb.length ? kb : ka;
  if (shorter.length < LIGHT_CONTAINS_MIN_LEN) return false;
  if (isCollisionStem(shorter)) return false;
  return longer.includes(shorter);
}

/** Test helper — normalized light key after dedicated aliases. */
export function lightKeyDebug(raw: string): string {
  return lightIdentityKey(raw) || normalizeTeamName(raw);
}
