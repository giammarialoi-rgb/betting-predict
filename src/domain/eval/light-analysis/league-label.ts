/**
 * Human Italian league titles for the Analizzati ticker.
 * Never invents a competition that is not on the row.
 */

const LEAGUE_IT: Array<{ keys: string[]; title: string }> = [
  { keys: ["e0", "premier league", "england premier", "eng.1", "soccer_epl"], title: "Inghilterra: Premier League" },
  { keys: ["e1", "championship", "eng.2", "soccer_efl_champ"], title: "Inghilterra: Championship" },
  { keys: ["i1", "serie a", "ita.1", "soccer_italy_serie_a"], title: "Italia: Serie A" },
  { keys: ["i2", "serie b", "ita.2", "soccer_italy_serie_b"], title: "Italia: Serie B" },
  { keys: ["sp1", "la liga", "primera", "esp.1", "soccer_spain_la_liga"], title: "Spagna: La Liga" },
  { keys: ["sp2", "segunda", "esp.2"], title: "Spagna: Segunda División" },
  { keys: ["d1", "bundesliga", "ger.1", "soccer_germany_bundesliga"], title: "Germania: Bundesliga" },
  { keys: ["d2", "2. bundesliga", "ger.2"], title: "Germania: 2. Bundesliga" },
  { keys: ["f1", "ligue 1", "ligue one", "fra.1", "soccer_france_ligue"], title: "Francia: Ligue 1" },
  { keys: ["f2", "ligue 2", "fra.2"], title: "Francia: Ligue 2" },
  { keys: ["n1", "eredivisie", "ned.1", "soccer_netherlands"], title: "Paesi Bassi: Eredivisie" },
  { keys: ["p1", "primeira", "liga portugal", "por.1", "soccer_portugal"], title: "Portogallo: Primeira Liga" },
  { keys: ["sc0", "premiership", "sco.1", "soccer_scotland"], title: "Scozia: Premiership" },
  { keys: ["b1", "pro league", "bel.1", "soccer_belgium"], title: "Belgio: Pro League" },
  { keys: ["t1", "super lig", "tur.1", "soccer_turkey"], title: "Turchia: Süper Lig" },
  { keys: ["g1", "super league greece", "gre.1"], title: "Grecia: Super League" },
  { keys: ["champions", "ucl", "uefa.champions"], title: "UEFA: Champions League" },
  { keys: ["europa league", "uel", "uefa.europa"], title: "UEFA: Europa League" },
  { keys: ["conference", "uefa.europa.conf"], title: "UEFA: Conference League" },
];

function compact(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/soccer[_-]?/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function leagueTitleIt(raw: string | null | undefined): string {
  const source = String(raw ?? "").trim();
  if (!source) return "Altre competizioni";
  const c = compact(source);
  const underscored = c.replace(/\s+/g, "_");
  for (const row of LEAGUE_IT) {
    if (row.keys.some((k) => c === k || underscored === k || c.includes(k))) {
      return row.title;
    }
  }
  return source.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
