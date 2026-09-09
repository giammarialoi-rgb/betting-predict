/**
 * TASK 016 — Blind Actuarial Bankroll Lab V1
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatActuarialReplayReport,
  runBlindActuarialBankrollLab,
} from "@/domain/eval/bankroll/blind-replay";
import { loadExp016Config } from "@/domain/eval/bankroll/exp016-config";
import {
  BlindLeakageError,
  BankrollAccountingError,
  assertAsOfNotAfter,
  assertNoOutcomeFieldsInDecisionPayload,
} from "@/domain/eval/bankroll/leakage";
import { BankrollLedger } from "@/domain/risk/bankroll/ledger";
import { computePolicyStake } from "@/domain/risk/bankroll/policies";
import { kellyFraction } from "@/domain/risk/engine";
import { correlationExposureGuard } from "@/domain/risk/correlation/guard";
import { runMonteCarloDiagnostic } from "@/domain/risk/actuarial/monte-carlo";
import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";

describe("TASK 016 Blind Actuarial Bankroll Lab V1", () => {
  it("loads immutable experiment config", () => {
    const c = loadExp016Config();
    assert.equal(c.experiment_id, "exp_016_actuarial_bankroll_v1");
    assert.equal(c.immutable, true);
    assert.equal(c.auto_promotion, false);
    assert.equal(c.winner, null);
    assert.equal(c.initial_bankroll_per_year, 1000);
    assert.equal(c.quality_gates.source_reliability, null);
  });

  it("Kelly formula is mathematically correct", () => {
    const f = kellyFraction(0.57, 2.0);
    // f* = (p*o - 1)/(o - 1) = (1.14-1)/1 = 0.14
    assert.ok(Math.abs(f - 0.14) < 1e-9);
  });

  it("fractional Kelly never uses full Kelly by default", () => {
    const sizing = loadExp016Config().sizing;
    assert.ok(sizing.kelly_fractional_factor < 1);
    const r = computePolicyStake({
      policy: "fractional_kelly",
      probability: 0.57,
      odds: 2.0,
      edge: null,
      state: {
        bankroll: 1000,
        peak: 1000,
        drawdown: 0,
        dayExposure: 0,
        matchExposure: 0,
        openClusterExposure: 0,
        masanielloWins: 0,
        masanielloBetsInCycle: 0,
        remainingEventsHint: 10,
      },
      sizing,
    });
    const full = 1000 * kellyFraction(0.57, 2.0);
    assert.ok(r.stake < full);
  });

  it("correlation guard caps same-event concentration", () => {
    const g = correlationExposureGuard({
      openSelections: [
        { eventId: "e1", market: "result", selection: "HOME", stake: 20 },
        { eventId: "e1", market: "total_goals", selection: "OVER", stake: 15 },
      ],
      candidate: {
        eventId: "e1",
        market: "both_teams_to_score",
        selection: "YES",
        stake: 30,
      },
      bankroll: 1000,
      maxClusterFraction: 0.05,
    });
    // max cluster = 50; others=35 → room=15
    assert.equal(g.cappedStake, 15);
    assert.ok(g.clusterExposureAfter <= 50 + 1e-9);
    assert.equal(g.allowed, true);
  });

  it("ledger reconciles bankrollAfter = before + pnl", () => {
    const led = new BankrollLedger();
    led.append({
      decisionId: "d1",
      experimentId: "exp_016",
      year: 2019,
      eventId: "e",
      market: "result",
      selection: "HOME",
      policy: "flat",
      bankrollBefore: 1000,
      stake: 10,
      odds: 2,
      lockedAt: "2019-01-01T00:00:00.000Z",
      outcomeRevealAt: null,
      won: null,
      voided: false,
      pnl: null,
      bankrollAfter: null,
      probability: 0.5,
      edge: null,
      asOf: "2019-01-01T00:00:00.000Z",
      oddsAvailableAt: "2019-01-01T00:00:00.000Z",
    });
    const s = led.settle({
      decisionId: "d1",
      won: true,
      outcomeRevealAt: "2019-01-01T20:00:00.000Z",
    });
    assert.equal(s.pnl, 10);
    assert.equal(s.bankrollAfter, 1010);
    const y = led.reconcileYear(2019, 1000, "flat");
    assert.equal(y.finalBankroll, 1010);
  });

  it("anti-cheating: future odds / outcome fields → BlindLeakageError", () => {
    const asOf = new Date("2019-08-01T17:00:00.000Z");
    assert.throws(
      () =>
        assertAsOfNotAfter(new Date("2019-08-01T19:00:00.000Z"), asOf, "odds"),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        assertNoOutcomeFieldsInDecisionPayload(
          { final_score: "2-1", availableAt: asOf },
          asOf,
        ),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        assertNoOutcomeFieldsInDecisionPayload(
          { home_score: 2, availableAt: asOf },
          asOf,
        ),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        assertNoOutcomeFieldsInDecisionPayload(
          {
            availableAt: new Date("2019-08-01T18:30:00.000Z"),
          },
          asOf,
        ),
      BlindLeakageError,
    );
  });

  it("Monte Carlo is SIMULATED and does not alter historical ledger", () => {
    const mc = runMonteCarloDiagnostic({
      initialBankroll: 1000,
      decisionReturns: [0.01, -0.01, 0.02, -0.015],
      nPaths: 100,
      seed: 16,
      stepsPerPath: 20,
    });
    assert.equal(mc.kind, "SIMULATED");
    assert.ok(mc.note.includes("not retune"));
  });

  it("end-to-end solar-year lab: independent 1000 starts, winner null", () => {
    const pack = loadRealTruthLabPack();
    assert.ok(pack.events.length >= 40);
    const lab = runBlindActuarialBankrollLab({
      dataset: pack,
      policies: ["flat", "fractional_kelly", "risk_capped_kelly", "masaniello_challenger", "actuarial_v1"],
    });
    assert.equal(lab.winner, null);
    assert.equal(lab.auto_promotion, false);
    assert.equal(lab.temporal_leakage, "PASS");
    assert.equal(lab.outcome_firewall, "PASS");
    assert.equal(lab.evidence_firewall, "PASS");

    const flat2019 = lab.years.find(
      (y) => y.year === 2019 && y.policy === "flat" && y.status === "OK",
    );
    assert.ok(flat2019);
    assert.equal(flat2019!.initial_bankroll, 1000);

    const blocked2001 = lab.years.find(
      (y) => y.year === 2001 && y.policy === "flat",
    );
    assert.equal(blocked2001!.status, "INSUFFICIENT_HISTORY");

    // Independent years: 2020 also starts at 1000 even if 2019 ended elsewhere
    const flat2020 = lab.years.find(
      (y) => y.year === 2020 && y.policy === "flat" && y.status === "OK",
    );
    if (flat2020) assert.equal(flat2020.initial_bankroll, 1000);

    assert.equal(lab.markets.result, "ADMITTED");
    assert.equal(lab.markets.corners, "BLOCKED");

    for (const audit of lab.audits) {
      assert.equal(audit.outcomeAccessibleBeforeLock, false);
    }

    const text = formatActuarialReplayReport(lab);
    assert.ok(text.includes("NO_AUTO_PROMOTION"));
    assert.ok(text.includes("HISTORICAL"));
  });

  it("accounting mismatch throws BankrollAccountingError", () => {
    const led = new BankrollLedger();
    led.append({
      decisionId: "bad",
      experimentId: "x",
      year: 2019,
      eventId: "e",
      market: "result",
      selection: "HOME",
      policy: "flat",
      bankrollBefore: 1000,
      stake: 10,
      odds: 2,
      lockedAt: "t",
      outcomeRevealAt: null,
      won: null,
      voided: false,
      pnl: null,
      bankrollAfter: null,
      probability: 0.5,
      edge: null,
      asOf: "t",
      oddsAvailableAt: "t",
    });
    const e = led.entries[0]!;
    e.pnl = 10;
    e.bankrollAfter = 999;
    assert.throws(() => led.assertEntryInvariant(e), BankrollAccountingError);
  });
});
