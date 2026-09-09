/**
 * Deterministic line representation.
 * Prefer market_type + selection + line over fused ids like over_2_5.
 */

export type MarketLine = {
  /** Decimal line, e.g. 2.5, -0.25, 0.75 */
  value: number;
  /** Canonical string for identity keys */
  key: string;
};

const QUARTER = 0.25;

export function parseMarketLine(raw: string | number): MarketLine {
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) {
    throw new RangeError(`Invalid market line: ${raw}`);
  }
  return { value, key: formatLineKey(value) };
}

export function formatLineKey(value: number): string {
  // Avoid -0; keep up to 2 decimals for Asian quarters.
  const n = Object.is(value, -0) ? 0 : value;
  return n.toFixed(2).replace(/\.?0+$/, (m) => (m.includes(".") ? "" : m));
}

/** True for classic .5 totals (2.5, 3.5, …). */
export function isHalfLine(value: number): boolean {
  const frac = Math.abs(value % 1);
  return Math.abs(frac - 0.5) < 1e-9;
}

/** True for Asian quarter lines (±0.25, ±0.75). */
export function isAsianQuarterLine(value: number): boolean {
  const frac = Math.abs(value % 1);
  return (
    Math.abs(frac - QUARTER) < 1e-9 || Math.abs(frac - 3 * QUARTER) < 1e-9
  );
}

/**
 * Split an Asian quarter handicap into two half-stakes on neighboring .0/.5 lines.
 * Example: -0.25 → [-0.0, -0.5] (equal weight). Does not settle stakes.
 */
export function splitAsianQuarterLine(value: number): [number, number] {
  if (!isAsianQuarterLine(value)) {
    throw new RangeError("splitAsianQuarterLine requires a quarter line");
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const lower = Math.floor(abs * 2) / 2;
  const upper = lower + 0.5;
  return [sign * lower, sign * upper];
}

export function marketIdentityKey(parts: {
  marketType: string;
  selection: string;
  line?: number | null;
  teamRef?: string | null;
  playerRef?: string | null;
}): string {
  return [
    parts.marketType,
    parts.selection,
    parts.line === null || parts.line === undefined
      ? ""
      : formatLineKey(parts.line),
    parts.teamRef ?? "",
    parts.playerRef ?? "",
  ].join("|");
}
