import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { planCycle051, idlePlan051 } from "@/domain/eval/brain-051/scheduler";
import {
  shouldRestartWorker051,
  assessBrainHealth051,
  fingerprintPayload051,
} from "@/domain/eval/brain-051/health";
import { defaultBrainState051, saveBrainState051, loadExp051Config } from "@/domain/eval/brain-051/config";
import {
  atomicWriteJson051,
  eventDedupeKey051,
  quoteDedupeKey051,
  settlementDedupeKey051,
  jsonlHasKey051,
  learningCaseDedupeKey051,
} from "@/domain/eval/brain-051/integrity";
import { maybeOpenPaperBet051 } from "@/domain/eval/brain-051/paper";
import { auditTask051 } from "@/domain/eval/brain-051/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import type { Store044 } from "@/domain/eval/permanent-044/store";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";

function emptyStore(): Store044 {
  return {
    root: "/tmp",
    events: [],
    quotes: [],
    predictions: [],
    locks: [],
    settlements: [],
    autopsies: [],
    learning: [],
    eventFingerprints: new Set(),
    eventIds: new Set(),
    quoteFingerprints: new Set(),
    predictionIds: new Set(),
    lockEventIds: new Set(),
    autopsyIds: new Set(),
    learningIds: new Set(),
    settlementEventIds: new Set(),
  };
}

describe("TASK 051 autonomous 24/7 brain", () => {
  it("exp flags freeze capital and forbid TASK 052", () => {
    const cfg = loadExp051Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.open_task_052, false);
    assert.equal(cfg.modify_lab_a, false);
    assert.equal(cfg.no_artificial_event_cap, true);
  });

  it("scheduler prioritizes settlement then pre-lock then horizons", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    const base = emptyStore();
    const idle = planCycle051(base, now);
    assert.equal(idle.priority, "P4");
    assert.equal(idle.discover, true);

    const settleStore: Store044 = {
      ...base,
      events: [
        {
          event_id: "past1",
          canonical_event_id: "c",
          source: "t",
          source_event_id: "s",
          sport: "soccer",
          competition: "x",
          country: null,
          home_or_a: "A",
          away_or_b: "B",
          kickoff_utc: "2026-09-08T10:00:00.000Z",
          collected_at_utc: "2026-09-01T00:00:00.000Z",
          available_at_utc: "2026-09-01T00:00:00.000Z",
          semantic_level: "STRICT",
          data_quality: 1,
          fingerprint: "f",
          status: "SCHEDULED",
        },
      ],
      settlements: [],
    };
    assert.equal(planCycle051(settleStore, now).priority, "P0");

    const near: Store044 = {
      ...base,
      events: [
        {
          event_id: "near1",
          canonical_event_id: "c",
          source: "t",
          source_event_id: "s",
          sport: "soccer",
          competition: "x",
          country: null,
          home_or_a: "A",
          away_or_b: "B",
          kickoff_utc: "2026-09-08T12:45:00.000Z",
          collected_at_utc: "2026-09-01T00:00:00.000Z",
          available_at_utc: "2026-09-01T00:00:00.000Z",
          semantic_level: "STRICT",
          data_quality: 1,
          fingerprint: "f",
          status: "SCHEDULED",
        },
      ],
    };
    assert.equal(planCycle051(near, now).priority, "P5");
    assert.equal(idlePlan051().priority, "IDLE");
  });

  it("watchdog restarts on WORKER_DEAD or HEARTBEAT_STALE", () => {
    assert.equal(
      shouldRestartWorker051({
        ok: false,
        issues: [{ level: "CRITICAL", code: "WORKER_DEAD", message: "x" }],
        state: defaultBrainState051(),
        heartbeat_age_ms: null,
        store_size_bytes: null,
      }),
      true,
    );
    assert.equal(
      shouldRestartWorker051({
        ok: false,
        issues: [{ level: "ERROR", code: "HEARTBEAT_STALE", message: "x" }],
        state: defaultBrainState051(),
        heartbeat_age_ms: 999999,
        store_size_bytes: null,
      }),
      true,
    );
    assert.equal(
      shouldRestartWorker051({
        ok: true,
        issues: [],
        state: defaultBrainState051(),
        heartbeat_age_ms: 1000,
        store_size_bytes: null,
      }),
      false,
    );
  });

  it("integrity: atomic write + dedupe keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "t051-"));
    const p = join(dir, "state.json");
    atomicWriteJson051(p, { a: 1 });
    assert.equal(JSON.parse(readFileSync(p, "utf8")).a, 1);
    const e1 = eventDedupeKey051("odds", "abc");
    const e2 = eventDedupeKey051("odds", "abc");
    assert.equal(e1, e2);
    assert.notEqual(quoteDedupeKey051("e", "b", "1X2", "H", "t1"), quoteDedupeKey051("e", "b", "1X2", "H", "t2"));
    assert.equal(settlementDedupeKey051("e"), settlementDedupeKey051("e"));
    const jl = join(dir, "x.jsonl");
    writeFileSync(jl, JSON.stringify({ id: "k1" }) + "\n");
    assert.equal(jsonlHasKey051(jl, "id", "k1"), true);
    assert.equal(jsonlHasKey051(jl, "id", "k2"), false);
    assert.ok(learningCaseDedupeKey051("e", "PREDICTION_ERROR", "v2").length === 32);
    assert.ok(fingerprintPayload051({ x: 1 }).length === 64);
  });

  it("paper ledger opens only for BET/STRONG and never real money", () => {
    const dir = mkdtempSync(join(tmpdir(), "t051p-"));
    const decision: DecisionRecord048 = {
      decision_id: "d1",
      prediction_id: "p1",
      event_id: "e1",
      timestamp: "2026-09-08T12:00:00.000Z",
      decision: "BET_CANDIDATE",
      prediction: "HOME",
      market: "1X2",
      probability: 0.55,
      fair_probability: 0.5,
      market_probability: 0.5,
      confidence: 60,
      estimated_edge: 0.05,
      risk_score: 0.3,
      data_quality_score: 0.8,
      decision_reason_codes: [],
      explanation: {
        WHY_PRIMARY: "x",
        WHY_SUPPORTING: [],
        WHY_AGAINST: [],
        WHY_RISK: [],
        WHY_NO_BET: null,
      },
      model_version: "MODEL_v2_DECISION_ENGINE",
      capital: "CLOSED",
      real_money: false,
      observed_decision: true,
    };
    const a = maybeOpenPaperBet051({ root: dir, decision, nowIso: "2026-09-08T12:00:00.000Z" });
    assert.ok(a);
    assert.equal(a!.real_money, false);
    assert.equal(a!.capital, "PAPER_ONLY");
    const b = maybeOpenPaperBet051({ root: dir, decision, nowIso: "2026-09-08T12:01:00.000Z" });
    assert.equal(b, null);
    const noBet = maybeOpenPaperBet051({
      root: dir,
      decision: { ...decision, decision: "NO_BET", prediction_id: "p2" },
      nowIso: "2026-09-08T12:02:00.000Z",
    });
    assert.equal(noBet, null);
  });

  it("lock immutability + post-lock firewall", () => {
    let threw = false;
    try {
      mutateDecision(
        {
          decision_id: "x",
          event_id: "e",
          decision_timestamp_utc: "2026-01-01T00:00:00.000Z",
          window: "T-1h",
          state: "LOCKED",
          market: "1X2",
          home_raw: 0.4,
          draw_raw: 0.3,
          away_raw: 0.3,
          home_devig: 0.4,
          draw_devig: 0.3,
          away_devig: 0.3,
          overround: 1.05,
          bookmaker: "pinnacle",
          observation_ids: [],
          observation_only: true,
          decision_context_hash: "h",
        },
        { home_devig: 0.9 },
      );
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
    threw = false;
    try {
      assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z");
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("Lab A fingerprint stable across brain unit checks", () => {
    const before = labAFingerprint046();
    assertLabAUntouched046(before);
  });

  it("audit accepts READY verdict shape", () => {
    const r = auditTask051({
      experiment_id: "exp_051_autonomous_24_7_brain",
      task: "051",
      FINAL_VERDICT: "AUTONOMOUS_24_7_LIVE_BRAIN_READY",
      MODEL_EDGE: "UNKNOWN",
      STATISTICAL_READINESS: "WAITING_SETTLEMENTS",
      CAPITAL: "CLOSED",
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      LAB_A_MUTATION: false,
      LAB_A_EVENTS: 114,
      LAB_A_LOCKED: 114,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      EVENTS_ANALYZED: 200,
      SETTLED: 0,
      BRAIN_STATUS: "STOPPED",
      SCHEDULER_OK: true,
      WATCHDOG_LOGIC_OK: true,
      OBSERVATORY_API_CALLS_UI: 0,
      open_task_052: false,
      fingerprint: "x",
      experiment_sha256: "y",
    });
    assert.equal(r.ok, true);
  });

  it("brain state persists under tmp dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "t051b-"));
    mkdirSync(join(dir, "brain"), { recursive: true });
    const state = { ...defaultBrainState051(), status: "IDLE" as const, cycles_completed: 3 };
    saveBrainState051(dir, state);
    assert.equal(existsSync(join(dir, "brain", "brain-state.json")), true);
    void assessBrainHealth051(dir);
  });
});
