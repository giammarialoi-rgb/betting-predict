/**
 * Market settlement + derived probabilities from independent score models.
 * ROI only when a real historical price exists.
 */
import { poissonPmf } from "@/domain/eval/poisson-baseline";
import { negBinPmf } from "@/domain/eval/predictive-intelligence/models/negbin";
import type { PiLabel, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import type { Phase9MarketId, Phase9Match } from "@/domain/eval/phase-9/types";
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";

export type ScoreKind = "poisson" | "dixon_coles" | "negbin";

function tau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

export function scoreCell(
  kind: ScoreKind,
  h: number,
  a: number,
  lh: number,
  la: number,
  extra?: { rho?: number; r?: number },
): number {
  if (kind === "negbin") {
    const r = extra?.r ?? 8;
    return negBinPmf(h, lh, r) * negBinPmf(a, la, r);
  }
  const base = poissonPmf(h, lh) * poissonPmf(a, la);
  if (kind === "dixon_coles") return base * tau(h, a, lh, la, extra?.rho ?? -0.08);
  return base;
}

export function scoreMatrix(
  kind: ScoreKind,
  lh: number,
  la: number,
  extra?: { rho?: number; r?: number },
  max = 8,
): number[][] {
  const M: number[][] = [];
  let s = 0;
  for (let h = 0; h <= max; h += 1) {
    M[h] = [];
    for (let a = 0; a <= max; a += 1) {
      const c = Math.max(0, scoreCell(kind, h, a, lh, la, extra));
      M[h]![a] = c;
      s += c;
    }
  }
  if (s <= 0) return M;
  for (let h = 0; h <= max; h += 1) {
    for (let a = 0; a <= max; a += 1) M[h]![a]! /= s;
  }
  return M;
}

function sumWhere(M: number[][], pred: (h: number, a: number) => boolean): number {
  let s = 0;
  for (let h = 0; h < M.length; h += 1) {
    for (let a = 0; a < (M[h]?.length ?? 0); a += 1) {
      if (pred(h, a)) s += M[h]![a]!;
    }
  }
  return s;
}

export function derivedMarketProb(
  market: Phase9MarketId,
  M: number[][],
  p1x2: PiProb3,
): { p: number; label: string } | null {
  switch (market) {
    case "1X2":
      return { p: Math.max(p1x2.HOME, p1x2.DRAW, p1x2.AWAY), label: "argmax" };
    case "BTTS":
      return { p: sumWhere(M, (h, a) => h > 0 && a > 0), label: "YES" };
    case "OU_0_5":
      return { p: sumWhere(M, (h, a) => h + a > 0.5), label: "OVER" };
    case "OU_1_5":
      return { p: sumWhere(M, (h, a) => h + a > 1.5), label: "OVER" };
    case "OU_2_5":
      return { p: sumWhere(M, (h, a) => h + a > 2.5), label: "OVER" };
    case "OU_3_5":
      return { p: sumWhere(M, (h, a) => h + a > 3.5), label: "OVER" };
    case "MULTIGOL_1_2":
      return { p: sumWhere(M, (h, a) => h + a >= 1 && h + a <= 2), label: "YES" };
    case "MULTIGOL_1_3":
      return { p: sumWhere(M, (h, a) => h + a >= 1 && h + a <= 3), label: "YES" };
    case "MULTIGOL_2_3":
      return { p: sumWhere(M, (h, a) => h + a >= 2 && h + a <= 3), label: "YES" };
    case "MULTIGOL_2_4":
      return { p: sumWhere(M, (h, a) => h + a >= 2 && h + a <= 4), label: "YES" };
    case "TEAM_GOALS_HOME_O0_5":
      return { p: sumWhere(M, (h) => h > 0.5), label: "OVER" };
    case "TEAM_GOALS_HOME_O1_5":
      return { p: sumWhere(M, (h) => h > 1.5), label: "OVER" };
    case "TEAM_GOALS_AWAY_O0_5":
      return { p: sumWhere(M, (_h, a) => a > 0.5), label: "OVER" };
    case "TEAM_GOALS_AWAY_O1_5":
      return { p: sumWhere(M, (_h, a) => a > 1.5), label: "OVER" };
    case "DC":
      return { p: p1x2.HOME + p1x2.DRAW, label: "1X" };
    case "DNB": {
      const den = p1x2.HOME + p1x2.AWAY;
      return { p: den > 0 ? p1x2.HOME / den : 0.5, label: "HOME" };
    }
    case "CORNERS_O8_5":
    case "CORNERS_O9_5":
    case "CORNERS_O10_5":
    case "CARDS_O3_5":
    case "CARDS_O4_5":
      return null;
    default:
      return null;
  }
}

export function settleMarket(
  market: Phase9MarketId,
  m: Phase9Match,
): { settled: boolean; won: boolean | null; voided: boolean; reason: string | null } {
  const tot = m.fthg + m.ftag;
  switch (market) {
    case "1X2":
      return { settled: true, won: null, voided: false, reason: "use ftr vs selection" };
    case "DC":
      return { settled: true, won: m.ftr === "HOME" || m.ftr === "DRAW", voided: false, reason: null };
    case "DNB":
      if (m.ftr === "DRAW") return { settled: true, won: null, voided: true, reason: "draw_void" };
      return { settled: true, won: m.ftr === "HOME", voided: false, reason: null };
    case "BTTS":
      return { settled: true, won: m.fthg > 0 && m.ftag > 0, voided: false, reason: null };
    case "OU_0_5":
      return { settled: true, won: tot > 0.5, voided: false, reason: null };
    case "OU_1_5":
      return { settled: true, won: tot > 1.5, voided: false, reason: null };
    case "OU_2_5":
      return { settled: true, won: tot > 2.5, voided: false, reason: null };
    case "OU_3_5":
      return { settled: true, won: tot > 3.5, voided: false, reason: null };
    case "MULTIGOL_1_2":
      return { settled: true, won: tot >= 1 && tot <= 2, voided: false, reason: null };
    case "MULTIGOL_1_3":
      return { settled: true, won: tot >= 1 && tot <= 3, voided: false, reason: null };
    case "MULTIGOL_2_3":
      return { settled: true, won: tot >= 2 && tot <= 3, voided: false, reason: null };
    case "MULTIGOL_2_4":
      return { settled: true, won: tot >= 2 && tot <= 4, voided: false, reason: null };
    case "TEAM_GOALS_HOME_O0_5":
      return { settled: true, won: m.fthg > 0.5, voided: false, reason: null };
    case "TEAM_GOALS_HOME_O1_5":
      return { settled: true, won: m.fthg > 1.5, voided: false, reason: null };
    case "TEAM_GOALS_AWAY_O0_5":
      return { settled: true, won: m.ftag > 0.5, voided: false, reason: null };
    case "TEAM_GOALS_AWAY_O1_5":
      return { settled: true, won: m.ftag > 1.5, voided: false, reason: null };
    case "CORNERS_O8_5":
    case "CORNERS_O9_5":
    case "CORNERS_O10_5": {
      if (m.hc == null || m.ac == null) {
        return { settled: false, won: null, voided: false, reason: PHASE9_NON_DETERMINABILE };
      }
      const line = market === "CORNERS_O8_5" ? 8.5 : market === "CORNERS_O9_5" ? 9.5 : 10.5;
      return { settled: true, won: m.hc + m.ac > line, voided: false, reason: null };
    }
    case "CARDS_O3_5":
    case "CARDS_O4_5": {
      if (m.hy == null || m.ay == null) {
        return { settled: false, won: null, voided: false, reason: PHASE9_NON_DETERMINABILE };
      }
      const cards = (m.hy ?? 0) + (m.ay ?? 0) + (m.hr ?? 0) + (m.ar ?? 0);
      const line = market === "CARDS_O3_5" ? 3.5 : 4.5;
      return { settled: true, won: cards > line, voided: false, reason: null };
    }
    default:
      return { settled: false, won: null, voided: false, reason: PHASE9_NON_DETERMINABILE };
  }
}

export function settle1x2Selection(y: PiLabel, sel: PiLabel): boolean {
  return y === sel;
}

export const ALL_MARKETS: Phase9MarketId[] = [
  "1X2",
  "DC",
  "DNB",
  "BTTS",
  "OU_0_5",
  "OU_1_5",
  "OU_2_5",
  "OU_3_5",
  "MULTIGOL_1_2",
  "MULTIGOL_1_3",
  "MULTIGOL_2_3",
  "MULTIGOL_2_4",
  "TEAM_GOALS_HOME_O0_5",
  "TEAM_GOALS_HOME_O1_5",
  "TEAM_GOALS_AWAY_O0_5",
  "TEAM_GOALS_AWAY_O1_5",
  "CORNERS_O8_5",
  "CORNERS_O9_5",
  "CORNERS_O10_5",
  "CARDS_O3_5",
  "CARDS_O4_5",
];

export function historicalOddsForMarket(
  market: Phase9MarketId,
  m: Phase9Match,
): { price: number; implied: number } | null {
  if (market === "OU_2_5" && m.odds_ou25?.over != null && m.odds_ou25.over > 1) {
    return { price: m.odds_ou25.over, implied: 1 / m.odds_ou25.over };
  }
  if (market === "1X2") {
    const t =
      m.odds_open.B365.home != null
        ? m.odds_open.B365
        : m.odds_open.PS.home != null
          ? m.odds_open.PS
          : m.odds_open.Avg;
    if (t.home == null || t.draw == null || t.away == null) return null;
    return { price: t.home, implied: 1 / t.home };
  }
  return null;
}
