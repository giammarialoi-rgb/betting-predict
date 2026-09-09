/**
 * BeatTheBookie PHP generator semantics (Lisandro79 generate_odds_series_csv.php).
 *
 * $interval_mins = 60; $time_window_hours = 72;
 * Markers: kickoff - i hours for i in 0..71 (72 hourly LOCF bins).
 * Sorted ascending: column 0 = kickoff-71h, column 71 = kickoff (i=0).
 * Bin index for N hours before kickoff: 71 - N.
 *
 * T-72h does not exist (window is 71h…0h). Sub-hour windows do not exist.
 * Do not interpolate. Do not invent timezone on matches.date / odds_datetime.
 */

export const PHP_BINS = 72;
export const PHP_INTERVAL_MINUTES = 60;
export const PHP_MAX_HOURS_BEFORE = 71;

export const PREFERRED_BOOKIES = [
  "Pinnacle",
  "Pinnacle Sports",
  "bet365",
  "Unibet",
  "William Hill",
  "Betway",
  "Betfair Sports",
] as const;

/** 0-based PHP $bookie_name_to_index. Kaggle flattened columns are 1-based b{index+1}. */
export const PHP_BOOKIE_INDEX: Readonly<Record<string, number>> = Object.freeze({
  Interwetten: 0,
  bwin: 1,
  "bet-at-home": 2,
  Unibet: 3,
  "Stan James": 4,
  Expekt: 5,
  "10Bet": 6,
  "William Hill": 7,
  bet365: 8,
  "Pinnacle Sports": 9,
  Pinnacle: 9,
  DOXXbet: 10,
  Betsafe: 11,
  Betway: 12,
  "888sport": 13,
  Ladbrokes: 14,
  Betclic: 15,
  Sportingbet: 16,
  myBet: 17,
  mybet: 17,
  Betsson: 18,
  "188BET": 19,
  Jetbull: 20,
  "Paddy Power": 21,
  Tipico: 22,
  Coral: 23,
  SBOBET: 24,
  BetVictor: 25,
  "12BET": 26,
  Titanbet: 27,
  youwin: 28,
  ComeOn: 29,
  Betadonis: 30,
  "Betfair Sports": 31,
  Betfair: 31,
});

export function phpBinIndex(hoursBefore: number): number | null {
  if (!Number.isInteger(hoursBefore) || hoursBefore < 0 || hoursBefore > PHP_MAX_HOURS_BEFORE) {
    return null;
  }
  return PHP_MAX_HOURS_BEFORE - hoursBefore;
}

export function hoursBeforeFromBin(binIndex: number): number | null {
  if (!Number.isInteger(binIndex) || binIndex < 0 || binIndex >= PHP_BINS) return null;
  return PHP_MAX_HOURS_BEFORE - binIndex;
}

export const REQUESTED_WINDOWS = [
  "T-72h",
  "T-48h",
  "T-24h",
  "T-12h",
  "T-6h",
  "T-3h",
  "T-1h",
  "T-30m",
  "T-15m",
  "T-5m",
  "T-1m",
] as const;

export function windowExistsInPhpHourly(window: (typeof REQUESTED_WINDOWS)[number]): boolean {
  if (window === "T-72h") return false;
  if (window.endsWith("m")) return false;
  const hours = Number(window.slice(2, -1));
  return Number.isInteger(hours) && hours >= 1 && hours <= PHP_MAX_HOURS_BEFORE;
}
