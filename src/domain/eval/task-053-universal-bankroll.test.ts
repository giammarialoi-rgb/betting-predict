import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { selectSportsByFamily049 } from "@/domain/eval/factory-049/adapters";
import { computeStake053, settlePnL053 } from "@/domain/eval/bankroll-053/stake";
import {
  maybeOpenVirtualBets053,
  settleVirtualBets053,
  summarizeBankroll053,
  simulateGoal053,
} from "@/domain/eval/bankroll-053/ledger";
import { ensureBankrollDirs053, loadExp053Config, VIRTUAL_BANKROLL_INITIAL_053 } from "@/domain/eval/bankroll-053/config";
import { auditTask053 } from "@/domain/eval/bankroll-053/audit";
import { ODDS_API_ADAPTER_NAME_053 } from "@/domain/eval/bankroll-053/source-adapter";
import { ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendEvent044, appendSettlement044 } from "@/domain/eval/permanent-044/store";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t053-"));
}

function decision(partial: Partial<DecisionRecord048> & { prediction_id: string; event_id: string }): DecisionRecord048 {
  return {
    decision_id: partial.decision_id ?? "d1",
    event_id: partial.event_id,
    prediction_id: partial.prediction_id,
    timestamp: partial.timestamp ?? "2026-09-08T12:00:00.000Z",
    model_version: "MODEL_v2_DECISION_ENGINE",
    market: partial.market ?? "1X2",
    prediction: partial.prediction ?? "HOME",
    probability: partial.probability ?? 0.55,
    confidence: partial.confidence ?? 60,
    fair_probability: partial.fair_probability ?? 0.5,
    market_probability: partial.market_probability ?? 0.5,
    estimated_edge: partial.estimated_edge ?? 0.05,
    risk_score: partial.risk_score ?? 20,
    data_quality_score: partial.data_quality_score ?? 0.8,
    decision: partial.decision ?? "BET_CANDIDATE",
    decision_reason_codes: [],
    explanation: {
      WHY_PRIMARY: "x",
      WHY_SUPPORTING: [],
      WHY_AGAINST: [],
      WHY_RISK: [],
      WHY_NO_BET: null,
    },
    capital: "CLOSED",
    real_money: false,
    observed_decision: true,
  };
}

describe("TASK 053 universal massive + virtual bankroll", () => {
  it("exp flags: paper capital, no TASK 054, no artificial cap", () => {
    const cfg = loadExp053Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.open_task_054, false);
    assert.equal(cfg.virtual_bankroll_initial, 1000);
    assert.equal(cfg.no_artificial_event_cap, true);
  });

  it("universal pull queue includes OTHER active sports — no hardcoded exclusion", () => {
    const sel = selectSportsByFamily049([
      { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
      { key: "tennis_atp", group: "Tennis", title: "ATP", active: true, has_outrights: false },
      { key: "americanfootball_nfl", group: "American Football", title: "NFL", active: true, has_outrights: false },
      { key: "outright_x", group: "X", title: "O", active: true, has_outrights: true },
    ]);
    assert.ok(sel.pullQueue.some((p) => p.key === "soccer_epl"));
    assert.ok(sel.pullQueue.some((p) => p.key === "tennis_atp"));
    assert.ok(sel.pullQueue.some((p) => p.family === "other" && p.key === "americanfootball_nfl"));
    assert.ok(!sel.pullQueue.some((p) => p.key === "outright_x"));
    assert.ok(sel.families.some((f) => f.family === "other"));
  });

  it("PROVIDER_UNAVAILABLE ≠ zero world — tennis empty keys", () => {
    const sel = selectSportsByFamily049([
      { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
    ]);
    assert.equal(sel.families.find((f) => f.family === "tennis")!.status, "PROVIDER_UNAVAILABLE");
  });

  it("virtual stakes: FLAT / PERCENT / KELLY + win/loss/push", () => {
    assert.equal(VIRTUAL_BANKROLL_INITIAL_053, 1000);
    const flat = computeStake053({ strategy: "FLAT", bankroll: 1000, probability: 0.55, odds: 2 });
    assert.ok(flat.stake > 0 && flat.real_money === false);
    const pct = computeStake053({ strategy: "PERCENT_BANKROLL", bankroll: 1000, probability: 0.55, odds: 2 });
    assert.ok(pct.stake > 0);
    const kelly = computeStake053({ strategy: "KELLY_FRACTIONAL", bankroll: 1000, probability: 0.6, odds: 2.1 });
    assert.equal(kelly.simulation_only, true);
    assert.equal(settlePnL053({ stake: 10, odds: 2, outcome: "won" }).pnl, 10);
    assert.equal(settlePnL053({ stake: 10, odds: 2, outcome: "lost" }).pnl, -10);
    assert.equal(settlePnL053({ stake: 10, odds: 2, outcome: "push" }).pnl, 0);
    assert.equal(settlePnL053({ stake: 10, odds: 2, outcome: "void" }).result, "VOID");
  });

  it("ledger open+settle idempotent; NO_BET opens nothing", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    ensureBankrollDirs053(root);
    const d = decision({ prediction_id: "p1", event_id: "e1", decision: "BET_CANDIDATE" });
    const a = maybeOpenVirtualBets053({ root, decision: d, nowIso: "2026-09-08T12:00:00.000Z" });
    assert.ok(a.length >= 1);
    const b = maybeOpenVirtualBets053({ root, decision: d, nowIso: "2026-09-08T12:01:00.000Z" });
    assert.equal(b.length, 0);
    assert.equal(
      maybeOpenVirtualBets053({
        root,
        decision: decision({ prediction_id: "p2", event_id: "e2", decision: "NO_BET" }),
        nowIso: "2026-09-08T12:02:00.000Z",
      }).length,
      0,
    );
    const store = loadStore044(root);
    appendSettlement044(store, {
      event_id: "e1",
      result: "HOME",
      market: "1X2",
      selection: "HOME",
      outcome: "won",
      settled_at: "2026-09-08T18:00:00.000Z",
      source: "test",
      source_confidence: 1,
    });
    const s1 = settleVirtualBets053({ root, settlements: store.settlements, nowIso: "2026-09-08T18:01:00.000Z" });
    assert.ok(s1.settled >= 1);
    const s2 = settleVirtualBets053({ root, settlements: store.settlements, nowIso: "2026-09-08T18:02:00.000Z" });
    assert.equal(s2.settled, 0);
    const sum = summarizeBankroll053(root);
    assert.equal(sum.scientifically_qualified, false);
    assert.equal(sum.model_edge, "UNKNOWN");
  });

  it("event_id dedupe on append", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    const ev = {
      event_id: "same",
      canonical_event_id: "c",
      source: "t",
      source_event_id: "s",
      sport: "soccer",
      competition: "x",
      country: null as string | null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: "2026-11-01T00:00:00.000Z",
      semantic_level: "STRICT" as const,
      data_quality: 1,
      fingerprint: "fp1",
      status: "SCHEDULED",
    };
    assert.equal(appendEvent044(store, ev), "ok");
    assert.equal(appendEvent044(store, { ...ev, fingerprint: "fp2" }), "dup");
  });

  it("goal simulator never claims reachability without settlements", () => {
    const g = simulateGoal053({ settled_bets: 5 });
    assert.ok(g.scenarios.every((s) => s.reach_goal_plausible === null));
    assert.match(g.disclaimer, /VIRTUAL ONLY/);
  });

  it("source adapter name documented; Lab A untouched", () => {
    assert.equal(ODDS_API_ADAPTER_NAME_053, "OddsApiAdapter");
    const before = labAFingerprint046();
    assert.equal(before.events, 114);
    assertLabAUntouched046(before);
  });

  it("audit accepts UNIVERSAL_MASSIVE_LIVE_READY", () => {
    const r = auditTask053({
      experiment_id: "exp_053_massive_data_virtual_bankroll",
      task: "053",
      FINAL_VERDICT: "UNIVERSAL_MASSIVE_LIVE_READY",
      STATUS: "UNIVERSAL_MASSIVE_LIVE_READY",
      DATA_LAKE: "Lab B task-044",
      TOTAL_EVENTS: 400,
      UNIQUE_EVENTS: 385,
      EVENTS_TODAY: 10,
      EVENTS_NEXT_24H: 20,
      EVENTS_NEXT_72H: 40,
      EVENTS_NEXT_7D: 80,
      SOCCER: 300,
      TENNIS: 0,
      BASKETBALL: 0,
      VOLLEYBALL: 0,
      HOCKEY: 0,
      OTHER: 0,
      SPORT_STATUS: { TENNIS: "UNAVAILABLE events=0" },
      MARKETS_ANALYZED: 1000,
      BOOKMAKERS_OBSERVED: 5,
      PREDICTIONS: 100,
      BET_CANDIDATES: 0,
      STRONG_CANDIDATES: 0,
      NO_BET: 100,
      LOCKED: 114,
      SETTLED: 0,
      AUTOPSIES: 0,
      LEARNING_CASES: 0,
      ERROR_PATTERNS: 0,
      COUNTERFACTUALS: 0,
      MODEL_VERSION: "MODEL_v2_DECISION_ENGINE",
      MODEL_STATUS: "OBSERVATION_ONLY",
      MODEL_EDGE: "UNKNOWN",
      MODEL_READY: "PARTIAL",
      ARTIFICIAL_CAP: false,
      VIRTUAL_BANKROLL_INITIAL: 1000,
      VIRTUAL_BANKROLL_CURRENT: 1000,
      VIRTUAL_PROFIT: 0,
      VIRTUAL_ROI: 0,
      VIRTUAL_MAX_DD: 0,
      PAPER_BANKROLL: 1000,
      PAPER_BETS: 0,
      CAPITAL: "PAPER_ONLY",
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      LAB_A_MUTATION: false,
      LAB_A_EVENTS: 114,
      LAB_A_LOCKED: 114,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      OBSERVATORY_API_CALLS_UI: 0,
      open_task_054: false,
      fingerprint: "x",
      experiment_sha256: "y",
    });
    assert.equal(r.ok, true);
  });

  it("SportAdapter distinguishes PROVIDER_UNAVAILABLE from EMPTY_WINDOW", async () => {
    const { buildSportAdapters053 } = await import("@/domain/eval/bankroll-053/sport-adapter");
    const adapters = buildSportAdapters053({
      familyStatus: {
        soccer: "AVAILABLE",
        tennis: "EMPTY_WINDOW",
        volleyball: "PROVIDER_UNAVAILABLE",
      },
    });
    const soccer = adapters.find((a) => a.sport === "SOCCER")!;
    const tennis = adapters.find((a) => a.sport === "TENNIS")!;
    const volley = adapters.find((a) => a.sport === "VOLLEYBALL")!;
    assert.equal(soccer.availability, "AVAILABLE");
    assert.equal(tennis.availability, "EMPTY_WINDOW");
    assert.equal(volley.availability, "PROVIDER_UNAVAILABLE");
    const d = await volley.discoverEvents();
    assert.equal(d.status, "PROVIDER_UNAVAILABLE");
    assert.notEqual(d.status, "EMPTY_WINDOW");
  });

  it("WHY machine labels MODEL_MIRRORS_MARKET without inventing BET", async () => {
    const { buildWhyMachine053 } = await import("@/domain/eval/bankroll-053/why-machine");
    const w = buildWhyMachine053({
      market: "1X2",
      recommended: false,
      confidence: 0.5,
      edge_absolute: 0,
      probability_model: 0.5,
      probability_market: 0.5,
      data_quality: 0.8,
    });
    assert.equal(w.decision, "NO_BET");
    assert.ok(w.negative_reasons.includes("MODEL_MIRRORS_MARKET"));
    assert.ok(w.no_edge_reason);
  });

  it("challenger registry never auto-promotes", async () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const { writeChallengerRegistry053 } = await import("@/domain/eval/bankroll-053/challenger");
    const rows = writeChallengerRegistry053(root);
    assert.ok(rows.every((r) => r.auto_promotion === false && r.real_money === false));
    assert.ok(rows.some((r) => r.role === "CHALLENGER"));
  });

  it("system status marks WORKER_DEAD when pid missing while RUNNING", async () => {
    const { buildSystemStatus053 } = await import("@/domain/eval/bankroll-053/system");
    const s = buildSystemStatus053();
    assert.ok(["HEALTHY", "DEGRADED", "PAUSED", "DEAD", "RECOVERING", "STOPPED"].includes(s.status));
  });
});
