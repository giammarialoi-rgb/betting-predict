/** Multi-bookmaker triangulation — compare prices across sources without overwrite. */

export type OddsPoint054 = {
  source: string;
  bookmaker: string;
  market: string;
  selection: string;
  line: number | null;
  price: number;
  available_at: string;
};

export type Triangulation054 = {
  min_odds: number;
  max_odds: number;
  mean_odds: number;
  median_odds: number;
  best_bookmaker: string;
  bookmaker_count: number;
  dispersion: number;
  sources: string[];
};

export function triangulateOdds054(points: OddsPoint054[]): Triangulation054 | null {
  if (!points.length) return null;
  const prices = points.map((p) => p.price).filter((n) => Number.isFinite(n) && n > 1);
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const min_odds = sorted[0]!;
  const max_odds = sorted[sorted.length - 1]!;
  const mean_odds = Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(4));
  const mid = Math.floor(sorted.length / 2);
  const median_odds =
    sorted.length % 2 === 0 ? Number(((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(4)) : sorted[mid]!;
  const best = points.reduce((a, b) => (b.price > a.price ? b : a));
  const books = new Set(points.map((p) => p.bookmaker));
  const sources = [...new Set(points.map((p) => p.source))];
  return {
    min_odds,
    max_odds,
    mean_odds,
    median_odds,
    best_bookmaker: best.bookmaker,
    bookmaker_count: books.size,
    dispersion: Number((max_odds - min_odds).toFixed(4)),
    sources,
  };
}
