/**
 * BeatTheBookie generator bookmaker rows (PHP $all_bookies).
 * Max / Avg / median are never bookmakers.
 */

export const BTB_SERIES_BOOKMAKERS: readonly string[] = [
  "10Bet",
  "12BET",
  "188BET",
  "bet-at-home",
  "bet365",
  "Betclic",
  "Betsafe",
  "Betsson",
  "BetVictor",
  "Betway",
  "ComeOn",
  "Coral",
  "DOXXbet",
  "Expekt",
  "Jetbull",
  "Ladbrokes",
  "myBet",
  "Paddy Power",
  "Pinnacle Sports",
  "SBOBET",
  "Sportingbet",
  "Stan James",
  "Tipico",
  "Unibet",
  "William Hill",
  "youwin",
  "888sport",
  "Interwetten",
  "Titanbet",
  "bwin",
  "Betadonis",
  "Betfair Sports",
];

export function isAggregateBookmakerLabel(label: string): boolean {
  return /^(max|avg|average|median|consensus)$/i.test(label.trim());
}
