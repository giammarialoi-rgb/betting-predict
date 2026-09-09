import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAllSourceAdapters055 } from "@/services/sources/registry-055";
import { createSofascoreAdapter055 } from "@/services/sources/sofascore/adapter";
import { createFlashscoreAdapter055 } from "@/services/sources/flashscore/adapter";
import { createSoccerwayAdapter055 } from "@/services/sources/soccerway/adapter";
import { buildUniversalCatalog055, sportFamily055 } from "@/domain/eval/catalog-055/universal";
import { buildLineage055 } from "@/domain/eval/catalog-055/lineage";
import { loadExp055Config } from "@/domain/eval/catalog-055/config";
import { auditTask055 } from "@/domain/eval/catalog-055/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { assertNoBypass054 } from "@/services/sources/directa";
import type { SourceEvent055 } from "@/services/sources/types";

function se(partial: Partial<SourceEvent055> & Pick<SourceEvent055, "source_id" | "source_event_id" | "home" | "away">): SourceEvent055 {
  return {
    sport: "soccer",
    competition: "X",
    country: null,
    commence_time: "2026-09-10T18:00:00.000Z",
    event_status: null,
    ingested_at: "t",
    available_at: "t",
    source_published_at: null,
    content_hash: "h",
    ...partial,
  };
}

describe("TASK 055 multi-source universal discovery", () => {
  it("exp flags: paper, no scrape, no TASK 056, no artificial cap", () => {
    const cfg = loadExp055Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.open_task_056, false);
    assert.equal(cfg.scraping_default, false);
    assert.equal(cfg.no_artificial_event_cap, true);
    assert.equal(cfg.virtual_bankroll_initial, 1000);
  });

  it("adapters: Odds present; Sofa/Flash/Soccerway DISABLED_BY_POLICY", async () => {
    const all = createAllSourceAdapters055();
    assert.ok(all.some((a) => a.sourceId === "THE_ODDS_API"));
    for (const a of [createSofascoreAdapter055(), createFlashscoreAdapter055(), createSoccerwayAdapter055()]) {
      assert.equal(a.health().status, "DISABLED_BY_POLICY");
      const d = await a.discoverEvents();
      assert.equal(d.status, "DISABLED_BY_POLICY");
      assert.equal(d.events.length, 0);
    }
  });

  it("EMPTY is distinct from DISABLED_BY_POLICY on Odds adapter health when store empty-or-not", () => {
    const odds = createAllSourceAdapters055().find((a) => a.sourceId === "THE_ODDS_API")!;
    const st = odds.health().status;
    assert.ok(st === "ACTIVE" || st === "EMPTY");
    assert.notEqual(st, "DISABLED_BY_POLICY");
  });

  it("compliance denies bypass", () => {
    assert.throws(() => assertNoBypass054("bypass_captcha"));
  });

  it("universal matching merges Inter Milan ↔ Internazionale", () => {
    const { universals, matched_pairs } = buildUniversalCatalog055(
      [
        {
          source: "THE_ODDS_API",
          events: [se({ source_id: "THE_ODDS_API", source_event_id: "o1", home: "Inter Milan", away: "AC Milan" })],
        },
        {
          source: "SOFASCORE",
          events: [se({ source_id: "SOFASCORE", source_event_id: "s1", home: "Internazionale", away: "Milan" })],
        },
      ],
      "2026-09-08T12:00:00.000Z",
    );
    assert.equal(universals.length, 1);
    assert.ok(matched_pairs >= 1);
    assert.ok(universals[0]!.source_ids.includes("THE_ODDS_API"));
    assert.ok(universals[0]!.source_ids.includes("SOFASCORE"));
    assert.equal(universals[0]!.odds_status, "ODDS_AVAILABLE");
  });

  it("sport family normalization", () => {
    assert.equal(sportFamily055("soccer_epl"), "soccer");
    assert.equal(sportFamily055("tennis_atp"), "tennis");
    assert.equal(sportFamily055("basketball_nba"), "basketball");
  });

  it("lineage has full chain and post-event steps after lock", () => {
    const steps = buildLineage055({
      sources: ["THE_ODDS_API"],
      observation_at: "t0",
      snapshot_at: "t1",
      prediction_id: "p",
      prediction_at: "t2",
      decision: "NO_BET",
      lock_at: "t3",
      result_at: "t4",
      autopsy_id: "a",
      learning_id: "l",
    });
    assert.equal(steps[0]!.step, "SOURCE");
    assert.equal(steps[6]!.step, "LOCK");
    assert.equal(steps[7]!.step, "RESULT");
    assert.ok(steps.find((s) => s.note === "no_retroactive_prediction_edit"));
  });

  it("Lab A untouched + audit READY shape", () => {
    const before = labAFingerprint046();
    assert.equal(before.events, 114);
    assertLabAUntouched046(before);
    const r = auditTask055({
      experiment_id: "exp_055_multisource_universal_discovery",
      task: "055",
      FINAL_VERDICT: "UNIVERSAL_24_7_SPORTS_INTELLIGENCE_BRAIN_READY",
      SYSTEM_STATUS: "HEALTHY",
      SUPERVISOR_STATUS: "ALIVE",
      WORKER_STATUS: "ALIVE",
      SUPERVISOR_ALIVE: true,
      WORKER_ALIVE: true,
      HEARTBEAT_FRESH: true,
      AUTOSTART_STATUS: "VERIFIED:StartupOnly",
      AUTOSTART_INSTALLED: true,
      AUTOSTART_VERIFIED: true,
      ACTIVE_MECHANISM: "StartupOnly",
      NO_DUPLICATE_WORKERS: true,
      TOTAL_EVENTS: 400,
      UNIQUE_EVENTS: 385,
      NEW_EVENTS: 271,
      EVENTS_BY_SPORT: { soccer: 385 },
      EVENTS_TODAY: 10,
      EVENTS_NEXT_24H: 20,
      EVENTS_NEXT_72H: 40,
      EVENTS_NEXT_7D: 80,
      EVENTS_NEXT_30D: 100,
      PREDICTIONS: 300,
      BET_CANDIDATES: 0,
      STRONG_CANDIDATES: 0,
      NO_BET: 300,
      MARKETS: 5,
      MARKETS_ANALYZED: 5,
      QUOTES: 1000,
      SNAPSHOTS: 10,
      SOURCE_STATUS: [
        {
          sourceId: "THE_ODDS_API",
          status: "ACTIVE",
          enabled: true,
          last_success_at: null,
          last_error: null,
          events_discovered: 385,
          events_matched: 385,
          quotes: 1,
          markets: 1,
          api_calls: 0,
          rate_limit_note: null,
          last_update: null,
          reason: null,
        },
        {
          sourceId: "SOFASCORE",
          status: "DISABLED_BY_POLICY",
          enabled: false,
          last_success_at: null,
          last_error: "x",
          events_discovered: 0,
          events_matched: 0,
          quotes: 0,
          markets: 0,
          api_calls: 0,
          rate_limit_note: null,
          last_update: null,
          reason: "x",
        },
      ],
      SPORT_STATUS: {
        SOCCER: { status: "ACTIVE", events: 385, reason: "ACTIVE" },
      },
      LOCKED: 1,
      SETTLED: 1,
      AUTOPSIES: 1,
      LEARNING_CASES: 1,
      ERROR_PATTERNS: 0,
      COUNTERFACTUALS: 0,
      PAPER_BANKROLL: 1000,
      PAPER_CAPITAL: 1000,
      PAPER_PNL: 0,
      PAPER_ROI: 0,
      PAPER_INITIAL_CAPITAL: 1000,
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      MODEL_VERSION: "MODEL_v2_DECISION_ENGINE",
      CHALLENGERS: 1,
      MODEL_EDGE: "UNKNOWN",
      CAPITAL: "PAPER_ONLY",
      ARTIFICIAL_CAP: false,
      LAB_A_MUTATION: false,
      LAB_A_EVENTS: 114,
      LAB_A_LOCKED: 114,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      BUDGET: "daemon_owned",
      API_CALLS: 0,
      MULTI_SPORT_ADAPTERS: "READY",
      MULTI_MARKET_ENGINE: "READY",
      SETTLEMENT: "READY",
      AUTOPSY: "READY",
      LEARNING: "READY",
      COUNTERFACTUAL: "READY",
      ERROR_PATTERNS_GATE: "READY",
      CONTROL_CENTER: "READY",
      CURRENT_WORK_VISIBLE: true,
      EVENT_DETAIL: "READY",
      BUDGET_FIREWALL: "PASS",
      RECOVERY: "READY",
      CURRENT_ACTIVITY: "IDLE",
      OBSERVATORY_API_CALLS_UI: 0,
      consolidation: {} as never,
      open_task_056: false,
      fingerprint: "x",
      experiment_sha256: "y",
    });
    assert.equal(r.ok, true);
  });
});
