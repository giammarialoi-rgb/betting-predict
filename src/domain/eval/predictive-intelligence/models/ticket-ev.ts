/**
 * TICKET_EV — what a multi-selection ticket is actually worth.
 *
 * A multiple is a leverage instrument: it compounds whatever each leg carries.
 * With a real edge per leg it compounds the edge; with bookmaker margin it
 * compounds the margin. Nothing in between. This module computes which of the
 * two is happening, before the ticket is placed.
 *
 * Three errors it is built to make impossible:
 *   1. Combining selections from the SAME match as if they were independent.
 *      Correlated legs must be read off the joint score matrix, never
 *      multiplied. p(1) * p(Over 2.5) is not p(1 AND Over 2.5).
 *   2. Believing a multi-leg bonus rescues a negative ticket. The bonus is
 *      worth a fixed number of margin points per leg; this prints that number.
 *   3. Silently mis-reading a selection code. Unknown codes throw.
 *
 * Half-time and in-play markets are deliberately unsupported: they are not a
 * function of the final score, so this matrix cannot price them.
 */
import type { PiProb3 } from "@/domain/eval/predictive-intelligence/types";

/** A selection expressed as a predicate over the final score. */
export type ScorePredicate = (homeGoals: number, awayGoals: number) => boolean;

const RE_OVER_UNDER = /^([OU])(\d+(?:\.\d+)?)$/;
const RE_MULTIGOL = /^MG_([HAT])_(\d+)_(\d+)$/;
const RE_CORRECT_SCORE = /^CS_(\d+)_(\d+)$/;
const RE_HANDICAP = /^AH_([HA])_(-?\d+(?:\.\d+)?)$/;

/**
 * Selection codes, all functions of the final score:
 *   1 X 2            match result
 *   1X X2 12         double chance
 *   O2.5 U2.5 ...    total goals over/under any line
 *   GG NG            both teams to score / not
 *   MG_H_1_3         multigol home 1..3   (H home, A away, T total)
 *   ODD EVEN         total goals parity
 *   CS_2_1           correct score
 *   AH_H_-1          European handicap: home with -1 applied, must still win
 *   SCORES_H SCORES_A   that team scores at least once
 */
export function selectionPredicate(code: string): ScorePredicate {
  const c = code.trim().toUpperCase();
  switch (c) {
    case "1":
      return (h, a) => h > a;
    case "X":
      return (h, a) => h === a;
    case "2":
      return (h, a) => h < a;
    case "1X":
      return (h, a) => h >= a;
    case "X2":
      return (h, a) => h <= a;
    case "12":
      return (h, a) => h !== a;
    case "GG":
      return (h, a) => h > 0 && a > 0;
    case "NG":
      return (h, a) => h === 0 || a === 0;
    case "ODD":
      return (h, a) => (h + a) % 2 === 1;
    case "EVEN":
      return (h, a) => (h + a) % 2 === 0;
    case "SCORES_H":
      return (h) => h > 0;
    case "SCORES_A":
      return (_h, a) => a > 0;
    default:
      break;
  }

  const ou = RE_OVER_UNDER.exec(c);
  if (ou) {
    const line = Number(ou[2]);
    if (!Number.isFinite(line)) throw new Error(`linea non valida: ${code}`);
    if (Number.isInteger(line)) {
      throw new Error(
        `linea intera non supportata (${code}): produce rimborso parziale, non un esito binario`,
      );
    }
    return ou[1] === "O" ? (h, a) => h + a > line : (h, a) => h + a < line;
  }

  const mg = RE_MULTIGOL.exec(c);
  if (mg) {
    const lo = Number(mg[2]);
    const hi = Number(mg[3]);
    if (lo > hi) throw new Error(`intervallo multigol invertito: ${code}`);
    const pick = mg[1];
    return (h, a) => {
      const v = pick === "H" ? h : pick === "A" ? a : h + a;
      return v >= lo && v <= hi;
    };
  }

  const cs = RE_CORRECT_SCORE.exec(c);
  if (cs) {
    const ch = Number(cs[1]);
    const ca = Number(cs[2]);
    return (h, a) => h === ch && a === ca;
  }

  const ah = RE_HANDICAP.exec(c);
  if (ah) {
    const hcp = Number(ah[2]);
    if (Number.isInteger(hcp)) {
      throw new Error(
        `handicap intero non supportato (${code}): il pareggio handicap da rimborso, non un esito binario`,
      );
    }
    return ah[1] === "H" ? (h, a) => h + hcp > a : (h, a) => a + hcp > h;
  }

  throw new Error(`codice selezione sconosciuto: ${code}`);
}

export type TicketLeg = {
  legId: string;
  /** Legs sharing a matchId are correlated and priced off one score matrix. */
  matchId: string;
  selection: string;
  /** Price actually taken. */
  odds: number;
  /** Independent model probability, when no score matrix is available. */
  modelProb?: number;
  /** De-vigged market probability for this selection, when known. */
  marketProb?: number | null;
  label?: string;
};

/** Score matrices by matchId. Legs whose match has one are priced exactly. */
export type MatchMatrices = Map<string, number[][]>;

export type BonusTier = { minLegs: number; bonusPct: number };

/**
 * Multi-leg bonus ladder. Book-specific and time-specific: the Italian ladders
 * of 2016-17 paid 15-100%, the same operators paid 0% by 2022. Always measured
 * from current terms, never assumed.
 */
export function bonusFor(nLegs: number, ladder: readonly BonusTier[]): number {
  let b = 0;
  for (const t of ladder) if (nLegs >= t.minLegs && t.bonusPct > b) b = t.bonusPct;
  return b;
}

export const NO_BONUS: readonly BonusTier[] = [];

export type CorrelationNote = {
  matchId: string;
  legIds: string[];
  p_independent: number;
  p_joint: number;
  /** >1 the book's independent pricing understates the combo, <1 overstates it. */
  ratio: number;
  priced_exactly: boolean;
};

export type TicketEvaluation = {
  n_legs: number;
  n_matches: number;
  product_odds: number;
  bonus_pct: number;
  gross_return_multiple: number;
  p_win_naive: number;
  p_win: number;
  ev: number;
  ev_without_bonus: number;
  /** Largest average margin per leg still consistent with break-even. */
  break_even_margin_per_leg: number;
  /** Margin points per leg the bonus is worth. */
  bonus_worth_per_leg: number;
  correlation: CorrelationNote[];
  warnings: string[];
};

function sumMatrix(matrix: number[][], preds: ScorePredicate[]): number {
  let s = 0;
  for (let h = 0; h < matrix.length; h += 1) {
    const row = matrix[h]!;
    for (let a = 0; a < row.length; a += 1) {
      let ok = true;
      for (const p of preds) {
        if (!p(h, a)) {
          ok = false;
          break;
        }
      }
      if (ok) s += row[a]!;
    }
  }
  return s;
}

export function evaluateTicket(input: {
  legs: readonly TicketLeg[];
  matrices?: MatchMatrices;
  ladder?: readonly BonusTier[];
}): TicketEvaluation {
  const legs = input.legs;
  const warnings: string[] = [];
  if (!legs.length) throw new Error("schedina vuota");

  const seen = new Set<string>();
  for (const l of legs) {
    if (seen.has(l.legId)) throw new Error(`legId duplicato: ${l.legId}`);
    seen.add(l.legId);
    if (!(l.odds > 1)) throw new Error(`quota non valida su ${l.legId}: ${l.odds}`);
  }

  const byMatch = new Map<string, TicketLeg[]>();
  for (const l of legs) {
    const arr = byMatch.get(l.matchId) ?? [];
    arr.push(l);
    byMatch.set(l.matchId, arr);
  }

  const ladder = input.ladder ?? NO_BONUS;
  const productOdds = legs.reduce((acc, l) => acc * l.odds, 1);
  const bonusPct = bonusFor(legs.length, ladder);

  const legProb = (l: TicketLeg): number => {
    const m = input.matrices?.get(l.matchId);
    if (m) return sumMatrix(m, [selectionPredicate(l.selection)]);
    if (l.modelProb != null && l.modelProb > 0 && l.modelProb < 1) return l.modelProb;
    throw new Error(
      `nessuna probabilita per ${l.legId}: serve una matrice per ${l.matchId} oppure modelProb`,
    );
  };

  let pNaive = 1;
  for (const l of legs) pNaive *= legProb(l);

  let pJoint = 1;
  const correlation: CorrelationNote[] = [];
  for (const [matchId, group] of byMatch) {
    const matrix = input.matrices?.get(matchId);
    const indep = group.reduce((acc, l) => acc * legProb(l), 1);
    if (group.length === 1) {
      pJoint *= indep;
      continue;
    }
    if (!matrix) {
      pJoint *= indep;
      correlation.push({
        matchId,
        legIds: group.map((l) => l.legId),
        p_independent: indep,
        p_joint: indep,
        ratio: 1,
        priced_exactly: false,
      });
      warnings.push(
        `${group.length} selezioni sulla stessa partita (${matchId}) senza matrice: trattate come indipendenti, il valore reale e ignoto`,
      );
      continue;
    }
    const joint = sumMatrix(
      matrix,
      group.map((l) => selectionPredicate(l.selection)),
    );
    pJoint *= joint;
    correlation.push({
      matchId,
      legIds: group.map((l) => l.legId),
      p_independent: indep,
      p_joint: joint,
      ratio: indep > 0 ? joint / indep : 0,
      priced_exactly: true,
    });
    if (joint === 0) {
      warnings.push(
        `selezioni incompatibili sulla stessa partita (${matchId}): la schedina non puo vincere`,
      );
    }
  }

  const grossMultiple = productOdds * (1 + bonusPct);
  const ev = pJoint * grossMultiple;
  const evNoBonus = pJoint * productOdds;
  const n = legs.length;
  const breakEvenMargin = 1 - Math.pow(1 + bonusPct, -1 / n);
  const bonusWorth = breakEvenMargin;

  if (ev < 1) {
    warnings.push(
      `EV ${ev.toFixed(3)} per euro giocato: la schedina perde ${((1 - ev) * 100).toFixed(1)}% a lungo termine`,
    );
  }
  if (pJoint > 0 && pJoint < 0.02) {
    warnings.push(
      `probabilita di incasso ${(pJoint * 100).toFixed(2)}% (1 su ${Math.round(1 / pJoint)}): serve una banca adeguata alla varianza`,
    );
  }

  return {
    n_legs: n,
    n_matches: byMatch.size,
    product_odds: productOdds,
    bonus_pct: bonusPct,
    gross_return_multiple: grossMultiple,
    p_win_naive: pNaive,
    p_win: pJoint,
    ev,
    ev_without_bonus: evNoBonus,
    break_even_margin_per_leg: breakEvenMargin,
    bonus_worth_per_leg: bonusWorth,
    correlation,
    warnings,
  };
}

/**
 * Marginal effect of each leg on ticket EV. A leg whose removal RAISES EV is
 * costing money — the usual reason a long list underperforms its parts.
 */
export function legContributions(input: {
  legs: readonly TicketLeg[];
  matrices?: MatchMatrices;
  ladder?: readonly BonusTier[];
}): { legId: string; selection: string; ev_with: number; ev_without: number; delta: number }[] {
  const full = evaluateTicket(input);
  const out: { legId: string; selection: string; ev_with: number; ev_without: number; delta: number }[] = [];
  for (const l of input.legs) {
    const rest = input.legs.filter((x) => x.legId !== l.legId);
    if (!rest.length) continue;
    const without = evaluateTicket({ ...input, legs: rest });
    out.push({
      legId: l.legId,
      selection: l.selection,
      ev_with: full.ev,
      ev_without: without.ev,
      delta: full.ev - without.ev,
    });
  }
  return out.sort((a, b) => a.delta - b.delta);
}

/** 1X2 probabilities read off a score matrix, for cross-checks. */
export function matrix1x2(matrix: number[][]): PiProb3 {
  return {
    HOME: sumMatrix(matrix, [selectionPredicate("1")]),
    DRAW: sumMatrix(matrix, [selectionPredicate("X")]),
    AWAY: sumMatrix(matrix, [selectionPredicate("2")]),
  };
}
