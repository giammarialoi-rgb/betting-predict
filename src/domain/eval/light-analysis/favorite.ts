/**
 * 1X2 favorite highlight — green for the highest independent probability.
 * Ties: home > draw > away (stable, not invented strength).
 */

export type OneXTwoKey = "home" | "draw" | "away";
export type FavoriteTone = "favorite" | "muted";

export type OneXTwoProbs = {
  home: number;
  draw: number;
  away: number;
};

export function isFiniteProb(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

export function pickFavorite1x2(probs: OneXTwoProbs): OneXTwoKey | null {
  if (!isFiniteProb(probs.home) || !isFiniteProb(probs.draw) || !isFiniteProb(probs.away)) {
    return null;
  }
  if (probs.home >= probs.draw && probs.home >= probs.away) return "home";
  if (probs.draw >= probs.away) return "draw";
  return "away";
}

export function favoriteTone(key: OneXTwoKey, favorite: OneXTwoKey | null): FavoriteTone {
  if (!favorite) return "muted";
  return key === favorite ? "favorite" : "muted";
}

export function favoriteClassName(tone: FavoriteTone): string {
  return tone === "favorite" ? "bm-fav" : "bm-muted-pct";
}
