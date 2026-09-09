/**
 * Edge / EV math — never invent probabilities.
 * implied_p = 1/odds; EV = model_p * odds - 1; edge = model_p - market_p
 */

export function impliedProbability056(decimalOdds: number): number | null {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return null;
  return 1 / decimalOdds;
}

export function fairOdds056(modelProbability: number): number | null {
  if (!Number.isFinite(modelProbability) || modelProbability <= 0 || modelProbability >= 1) return null;
  return 1 / modelProbability;
}

export function expectedValue056(modelProbability: number, decimalOdds: number): number | null {
  if (!Number.isFinite(modelProbability) || !Number.isFinite(decimalOdds)) return null;
  if (modelProbability < 0 || modelProbability > 1 || decimalOdds <= 1) return null;
  return modelProbability * decimalOdds - 1;
}

export function edgePp056(modelProbability: number, marketProbability: number): number | null {
  if (!Number.isFinite(modelProbability) || !Number.isFinite(marketProbability)) return null;
  return modelProbability - marketProbability;
}

/** Decision helper: MODEL_MIRRORS_MARKET when |edge| < threshold. */
export function mirrorsMarket056(
  modelProbability: number | null,
  marketProbability: number | null,
  threshold = 0.02,
): boolean {
  if (modelProbability == null || marketProbability == null) return false;
  return Math.abs(modelProbability - marketProbability) < threshold;
}
