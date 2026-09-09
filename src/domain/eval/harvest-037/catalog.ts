import type { RepoSpec037 } from "@/domain/eval/harvest-037/types";

export const REPOS_037: readonly RepoSpec037[] = [
  { id: "anishkhetani", repository: "AnishKhetani/premier-league-data", cluster: "football-data-co-uk", role: "MIRROR", mandatory: true },
  { id: "nm2890", repository: "nm2890/football-data", cluster: "open-close-averages", role: "RAW", mandatory: true },
  { id: "akareen", repository: "akareen/Football-Data-Analysis", cluster: "scraped-odds-date-time", role: "RAW", mandatory: true },
  { id: "ivanzou", repository: "ivanzou29/football_fair", cluster: "derived-features", role: "DERIVATIVE", mandatory: true },
  { id: "petermclagan", repository: "petermclagan/betfair-historical", cluster: "betfair-historic", role: "MIRROR", mandatory: true },
  { id: "petermclagan_underscore", repository: "petermclagan/betfair_historical", cluster: "betfair-historic", role: "REPOSITORY", mandatory: true },
  { id: "tarb", repository: "tarb/betfair_data", cluster: "betfair-historic", role: "PARSER", mandatory: true },
  { id: "hblauth", repository: "hblauth/betfair_historic_data", cluster: "betfair-historic", role: "PARSER", mandatory: true },
  { id: "betfair_historicdata", repository: "betfair/historicdata", cluster: "betfair-historic", role: "PARSER", mandatory: true },
  { id: "betfair_workbook", repository: "betfair/historic-data-workbook", cluster: "betfair-historic", role: "PARSER", mandatory: true },
  { id: "beatthebookie", repository: "Lisandro79/BeatTheBookie", cluster: "beatthebookie", role: "REPOSITORY", mandatory: true },
  { id: "soccer_dataset", repository: "v-eatpizzanot/soccer-dataset", cluster: "soccer-dataset", role: "RAW", mandatory: true },
  { id: "oddsharvester", repository: "jordantete/OddsHarvester", cluster: "oddsportal-scraper", role: "PARSER", mandatory: true },
  { id: "iredchuk", repository: "iredchuk/soccer-bookmaker-odds", cluster: "average-odds-no-date", role: "RAW", mandatory: false },
  { id: "sportyhack", repository: "odafeigho/SportyOddsHack", cluster: "models-no-archive", role: "REPOSITORY", mandatory: false },
  { id: "betfairutil", repository: "mberk/betfairutil", cluster: "betfair-historic", role: "PARSER", mandatory: false },
  { id: "liampauling", repository: "liampauling/betfair", cluster: "betfair-historic", role: "PARSER", mandatory: false },
];

export const CLUSTERS_037 = [
  "football-data-co-uk",
  "open-close-averages",
  "scraped-odds-date-time",
  "average-odds-no-date",
  "derived-features",
  "betfair-historic",
  "beatthebookie",
  "soccer-dataset",
  "oddsportal-scraper",
  "models-no-archive",
  "task-031-base",
] as const;
