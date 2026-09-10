/** Production assertion: odds must never enter the independent feature vector. */

const BANNED = /odds|b365|market_prob|devig|closing|quote|price/i;

export function assertIndependentOddsFirewall(input: {
  featureKeys: readonly string[];
  enteredKeys?: readonly string[];
  oddsEnteredModel?: boolean;
}): void {
  if (input.oddsEnteredModel === true) {
    throw new Error("ODDS_FIREWALL: odds_entered_model=true on independent dossier");
  }
  const entered = input.enteredKeys ?? input.featureKeys;
  for (const k of entered) {
    if (BANNED.test(k)) {
      throw new Error(`ODDS_FIREWALL: market/odds key entered model: ${k}`);
    }
  }
}