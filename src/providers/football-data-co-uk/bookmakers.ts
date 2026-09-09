/**
 * Declarative bookmaker column map for football-data.co.uk 1X2 markets.
 * Max/Avg/Bb* aggregates are intentionally excluded — not canonical bookmakers.
 *
 * Handicap / totals / Asian columns are out of TASK 006 scope.
 */
export type FootballDataCoUkBookmakerColumns = {
  slug: string;
  name: string;
  open: { home: string; draw: string; away: string };
  close: { home: string; draw: string; away: string };
};

export const FOOTBALL_DATA_CO_UK_BOOKMAKERS: readonly FootballDataCoUkBookmakerColumns[] =
  Object.freeze([
    {
      slug: "bet365",
      name: "Bet365",
      open: { home: "B365H", draw: "B365D", away: "B365A" },
      close: { home: "B365CH", draw: "B365CD", away: "B365CA" },
    },
    {
      slug: "pinnacle",
      name: "Pinnacle",
      open: { home: "PSH", draw: "PSD", away: "PSA" },
      close: { home: "PSCH", draw: "PSCD", away: "PSCA" },
    },
    {
      slug: "william-hill",
      name: "William Hill",
      open: { home: "WHH", draw: "WHD", away: "WHA" },
      close: { home: "WHCH", draw: "WHCD", away: "WHCA" },
    },
    {
      slug: "bet-and-win",
      name: "Bet&Win",
      open: { home: "BWH", draw: "BWD", away: "BWA" },
      close: { home: "BWCH", draw: "BWCD", away: "BWCA" },
    },
    {
      slug: "interwetten",
      name: "Interwetten",
      open: { home: "IWH", draw: "IWD", away: "IWA" },
      close: { home: "IWCH", draw: "IWCD", away: "IWCA" },
    },
    {
      slug: "vc-bet",
      name: "VC Bet",
      open: { home: "VCH", draw: "VCD", away: "VCA" },
      close: { home: "VCCH", draw: "VCCD", away: "VCCA" },
    },
  ]);

/** Division codes catalogued for acquisition (file may not exist for every season). */
export const FOOTBALL_DATA_CO_UK_DIVISIONS = {
  E0: { competitionKey: "E0", name: "Premier League", country: "England" },
  E1: { competitionKey: "E1", name: "Championship", country: "England" },
  E2: { competitionKey: "E2", name: "League One", country: "England" },
  E3: { competitionKey: "E3", name: "League Two", country: "England" },
  I1: { competitionKey: "I1", name: "Serie A", country: "Italy" },
  I2: { competitionKey: "I2", name: "Serie B", country: "Italy" },
  SP1: { competitionKey: "SP1", name: "La Liga", country: "Spain" },
  SP2: { competitionKey: "SP2", name: "La Liga 2", country: "Spain" },
  D1: { competitionKey: "D1", name: "Bundesliga", country: "Germany" },
  D2: { competitionKey: "D2", name: "2. Bundesliga", country: "Germany" },
  F1: { competitionKey: "F1", name: "Ligue 1", country: "France" },
  F2: { competitionKey: "F2", name: "Ligue 2", country: "France" },
  N1: { competitionKey: "N1", name: "Eredivisie", country: "Netherlands" },
  N2: { competitionKey: "N2", name: "Eerste Divisie", country: "Netherlands" },
  B1: { competitionKey: "B1", name: "Jupiler Pro League", country: "Belgium" },
  P1: { competitionKey: "P1", name: "Primeira Liga", country: "Portugal" },
} as const;

export type FootballDataCoUkDivisionCode =
  keyof typeof FOOTBALL_DATA_CO_UK_DIVISIONS;

export const FOOTBALL_DATA_CO_UK_SOURCE_ID = "football-data-co-uk";

export function footballDataCoUkCsvUrl(
  seasonCode: string,
  division: string,
): string {
  return `https://www.football-data.co.uk/mmz4281/${seasonCode}/${division}.csv`;
}
