import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bonusFor,
  evaluateTicket,
  legContributions,
  matrix1x2,
  selectionPredicate,
  type BonusTier,
  type TicketLeg,
} from "@/domain/eval/predictive-intelligence/models/ticket-ev";

/** Independent Poisson score matrix, good enough to exercise the algebra. */
function matrix(lh: number, la: number, max = 10): number[][] {
  const pmf = (k: number, l: number) => {
    let f = 1;
    for (let i = 2; i <= k; i += 1) f *= i;
    return (Math.exp(-l) * l ** k) / f;
  };
  const m: number[][] = [];
  let tot = 0;
  for (let h = 0; h <= max; h += 1) {
    const row: number[] = [];
    for (let a = 0; a <= max; a += 1) {
      const c = pmf(h, lh) * pmf(a, la);
      row.push(c);
      tot += c;
    }
    m.push(row);
  }
  for (const row of m) for (let i = 0; i < row.length; i += 1) row[i] = row[i]! / tot;
  return m;
}

test("selection codes map to the right scorelines", () => {
  const cases: [string, number, number, boolean][] = [
    ["1", 2, 1, true], ["1", 1, 1, false],
    ["X", 0, 0, true], ["2", 0, 1, true],
    ["1X", 1, 1, true], ["1X", 0, 1, false],
    ["X2", 1, 1, true], ["12", 1, 1, false],
    ["O2.5", 2, 1, true], ["O2.5", 1, 1, false],
    ["U2.5", 1, 1, true], ["O1.5", 1, 0, false],
    ["GG", 1, 1, true], ["GG", 2, 0, false],
    ["NG", 3, 0, true],
    ["MG_H_1_3", 2, 5, true], ["MG_H_1_3", 0, 0, false], ["MG_T_2_4", 2, 2, true],
    ["ODD", 2, 1, true], ["EVEN", 2, 2, true],
    ["CS_2_1", 2, 1, true], ["CS_2_1", 1, 2, false],
    ["AH_H_-1.5", 3, 1, true], ["AH_H_-1.5", 2, 1, false],
    ["SCORES_H", 1, 0, true], ["SCORES_A", 1, 0, false],
  ];
  for (const [code, h, a, want] of cases) {
    assert.equal(selectionPredicate(code)(h, a), want, `${code} su ${h}-${a}`);
  }
});

test("unknown or refund-prone codes throw instead of silently mispricing", () => {
  assert.throws(() => selectionPredicate("MULTIGOL CASA 1-3"), /sconosciuto/);
  assert.throws(() => selectionPredicate("1o2+"), /sconosciuto/);
  assert.throws(() => selectionPredicate("O2"), /rimborso parziale/);
  assert.throws(() => selectionPredicate("AH_H_-1"), /rimborso/);
});

test("same-match legs are priced off the joint matrix, not multiplied", () => {
  const m = matrix(1.6, 1.1);
  const matrices = new Map([["m1", m]]);
  // "1" and "Over 2.5" are positively correlated: winning teams score.
  const legs: TicketLeg[] = [
    { legId: "a", matchId: "m1", selection: "1", odds: 2.0 },
    { legId: "b", matchId: "m1", selection: "O2.5", odds: 1.9 },
  ];
  const ev = evaluateTicket({ legs, matrices });
  const note = ev.correlation[0]!;
  assert.equal(note.priced_exactly, true);
  assert.ok(
    note.p_joint > note.p_independent,
    `1 e Over 2.5 sono correlate positivamente: joint=${note.p_joint.toFixed(4)} indep=${note.p_independent.toFixed(4)}`,
  );
  assert.ok(Math.abs(ev.p_win - note.p_joint) < 1e-12);
  assert.ok(ev.p_win > ev.p_win_naive, "il prodotto sottostima questa combinazione");
});

test("negatively correlated legs are caught, and impossible ones are flagged", () => {
  const m = matrix(1.5, 1.2);
  const matrices = new Map([["m1", m]]);
  const neg = evaluateTicket({
    legs: [
      { legId: "a", matchId: "m1", selection: "O3.5", odds: 3.2 },
      { legId: "b", matchId: "m1", selection: "NG", odds: 2.1 },
    ],
    matrices,
  });
  assert.ok(neg.correlation[0]!.ratio < 1, "Over 3.5 + NoGoal e una combinazione sfavorevole");

  const impossible = evaluateTicket({
    legs: [
      { legId: "a", matchId: "m1", selection: "1", odds: 2 },
      { legId: "b", matchId: "m1", selection: "2", odds: 3 },
    ],
    matrices,
  });
  assert.equal(impossible.p_win, 0);
  assert.ok(impossible.warnings.some((w) => /non puo vincere/.test(w)));
});

test("the matrix reproduces 1X2 and totals consistently", () => {
  const m = matrix(1.4, 1.1);
  const p = matrix1x2(m);
  assert.ok(Math.abs(p.HOME + p.DRAW + p.AWAY - 1) < 1e-9);
  // P(Over 2.5) + P(Under 2.5) must be exactly 1 on a half line.
  const legs = (sel: string): TicketLeg[] => [{ legId: "x", matchId: "m", selection: sel, odds: 2 }];
  const over = evaluateTicket({ legs: legs("O2.5"), matrices: new Map([["m", m]]) }).p_win;
  const under = evaluateTicket({ legs: legs("U2.5"), matrices: new Map([["m", m]]) }).p_win;
  assert.ok(Math.abs(over + under - 1) < 1e-9);
});

test("bonus ladder and break-even margin match the 2016 slips", () => {
  const ladder: BonusTier[] = [
    { minLegs: 7, bonusPct: 0.18 },
    { minLegs: 10, bonusPct: 0.33 },
    { minLegs: 14, bonusPct: 0.5 },
  ];
  assert.equal(bonusFor(6, ladder), 0);
  assert.equal(bonusFor(7, ladder), 0.18);
  assert.equal(bonusFor(13, ladder), 0.33);
  assert.equal(bonusFor(20, ladder), 0.5);

  // 7 legs at 18% tolerate ~2.34% margin per leg; the real slip odds gave 6.156.
  const legs: TicketLeg[] = [1.15, 1.29, 1.46, 1.21, 1.08, 1.5, 1.45].map((o, i) => ({
    legId: `l${i}`,
    matchId: `m${i}`,
    selection: "1X",
    odds: o,
    modelProb: 1 / o,
  }));
  const ev = evaluateTicket({ legs, ladder });
  assert.ok(Math.abs(ev.product_odds - 6.1563) < 0.001, `prodotto quote ${ev.product_odds}`);
  assert.ok(
    Math.abs(ev.break_even_margin_per_leg - 0.0234) < 0.0005,
    `margine di pareggio ${ev.break_even_margin_per_leg}`,
  );
  // modelProb = 1/odds means zero edge and zero margin: the bonus alone makes it +EV.
  assert.ok(Math.abs(ev.ev - 1.18) < 1e-9, `EV a margine zero deve valere 1+bonus, vale ${ev.ev}`);
  assert.ok(Math.abs(ev.ev_without_bonus - 1) < 1e-9);
});

test("a leg that lowers EV is identified", () => {
  const ladder: BonusTier[] = [{ minLegs: 3, bonusPct: 0.05 }];
  const good: TicketLeg = { legId: "good", matchId: "m1", selection: "1", odds: 2.2, modelProb: 0.5 };
  const fair: TicketLeg = { legId: "fair", matchId: "m2", selection: "1", odds: 2.0, modelProb: 0.5 };
  const bad: TicketLeg = { legId: "bad", matchId: "m3", selection: "1", odds: 1.6, modelProb: 0.5 };
  const contrib = legContributions({ legs: [good, fair, bad], ladder });
  assert.equal(contrib[0]!.legId, "bad", "la gamba peggiore deve risultare prima");
  assert.ok(contrib[0]!.ev_without > contrib[0]!.ev_with, "togliendola l'EV sale");
});

test("duplicate legs and bad prices are rejected", () => {
  const l: TicketLeg = { legId: "a", matchId: "m", selection: "1", odds: 2, modelProb: 0.5 };
  assert.throws(() => evaluateTicket({ legs: [l, { ...l }] }), /duplicato/);
  assert.throws(() => evaluateTicket({ legs: [{ ...l, odds: 1 }] }), /quota non valida/);
  assert.throws(() => evaluateTicket({ legs: [{ legId: "z", matchId: "m", selection: "1", odds: 2 }] }), /nessuna probabilita/);
});
