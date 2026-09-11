/**
 * Deterministic, auditabile team name aliases for football-data.co.uk strings.
 * Keys are exact CSV HomeTeam/AwayTeam values (case-sensitive as published).
 * Values are canonical provider entity ids used in source_entity_map for this source.
 * No fuzzy matching.
 */
export const FOOTBALL_DATA_CO_UK_TEAM_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    "Man United": "manchester-united",
    "Man Utd": "manchester-united",
    "Manchester United": "manchester-united",
    Liverpool: "liverpool",
    Chelsea: "chelsea",
    Arsenal: "arsenal",
    "Man City": "manchester-city",
    "Manchester City": "manchester-city",
    Tottenham: "tottenham",
    Everton: "everton",
    "West Ham": "west-ham",
    Leicester: "leicester",
    Newcastle: "newcastle",
    Brighton: "brighton",
    Wolves: "wolves",
    "Crystal Palace": "crystal-palace",
    Southampton: "southampton",
    "Aston Villa": "aston-villa",
    Fulham: "fulham",
    Brentford: "brentford",
    Leeds: "leeds",
    Burnley: "burnley",
    Watford: "watford",
    Norwich: "norwich",
    "Sheffield United": "sheffield-united",
    Bournemouth: "bournemouth",
    "Nott'm Forest": "nottingham-forest",
    "Nottingham Forest": "nottingham-forest",
    "Nottm Forest": "nottingham-forest",
    "Inter": "inter",
    "Inter Milan": "inter",
    Milan: "milan",
    Juventus: "juventus",
    Napoli: "napoli",
    Roma: "roma",
    Lazio: "lazio",
    "Bayern Munich": "bayern-munich",
    "Bayern Munchen": "bayern-munich",
    Internazionale: "inter",
    PSV: "psv",
    "RB Leipzig": "leipzig",
    Leipzig: "leipzig",
    Como: "como",
    Sunderland: "sunderland",
    Fenerbahce: "fenerbahce",
    Atalanta: "atalanta",
    Bologna: "bologna",
    Torino: "torino",
    Fiorentina: "fiorentina",
    "Ath Madrid": "ath-madrid",
    "Ath Bilbao": "ath-bilbao",
    "Real Madrid": "real-madrid",
    Barcelona: "barcelona",
    Dortmund: "dortmund",
    "Paris SG": "paris-sg",
  });

export function resolveFootballDataCoUkTeamId(rawName: string): string | null {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return null;
  }
  return FOOTBALL_DATA_CO_UK_TEAM_ALIASES[trimmed] ?? null;
}
