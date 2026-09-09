import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDirectaAdapter054, assertNoBypass054, resolveDirectaPolicy054 } from "@/services/sources/directa";
import {
  matchEvents054,
  detectKickoffConflict054,
  marketNormalize054,
  availableAt054,
  normalizeParticipant054,
} from "@/domain/eval/catalog-054/matching";
import { loadExp054Config } from "@/domain/eval/catalog-054/config";
import { auditTask054 } from "@/domain/eval/catalog-054/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";

describe("TASK 054 Directa multisource catalog", () => {
  it("exp flags: paper capital, Directa scraping default false, no TASK 055", () => {
    const cfg = loadExp054Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.open_task_055, false);
    assert.equal(cfg.directa_scraping_default, false);
    assert.equal(cfg.no_artificial_event_cap, true);
    assert.equal(cfg.virtual_bankroll_initial, 1000);
  });

  it("Directa default DISABLED_BY_POLICY — no network scrape", async () => {
    const policy = resolveDirectaPolicy054();
    assert.equal(policy.policy_status, "DISABLED_BY_POLICY");
    const adapter = createDirectaAdapter054();
    const h = adapter.health();
    assert.equal(h.policy_status, "DISABLED_BY_POLICY");
    assert.equal(h.scraping_enabled, false);
    const ev = await adapter.discoverEvents();
    assert.equal(ev.status, "DISABLED_BY_POLICY");
    assert.equal(ev.events.length, 0);
  });

  it("compliance firewall denies bypass techniques", () => {
    assert.throws(() => assertNoBypass054("bypass_captcha"));
    assert.throws(() => assertNoBypass054("bypass_cloudflare"));
    assert.throws(() => assertNoBypass054("proxy_rotation_evasion"));
  });

  it("fuzzy participant normalize + exact/high match", () => {
    assert.equal(normalizeParticipant054("Inter Milan"), "inter milan");
    assert.equal(normalizeParticipant054("Internazionale"), "inter");
    const m = matchEvents054({
      sport_a: "soccer",
      sport_b: "soccer",
      p1_a: "Inter Milan",
      p2_a: "AC Milan",
      p1_b: "Internazionale",
      p2_b: "Milan",
      kickoff_a: "2026-09-10T18:00:00.000Z",
      kickoff_b: "2026-09-10T18:00:00.000Z",
    });
    assert.ok(m.class === "MATCH_EXACT" || m.class === "MATCH_HIGH_CONFIDENCE");
    assert.ok(m.canonical_event_id);
  });

  it("kickoff conflict detection does not overwrite", () => {
    const c = detectKickoffConflict054(
      "DIRECTA",
      "2026-09-10T18:00:00.000Z",
      "ODDS_API",
      "2026-09-10T18:15:00.000Z",
      "2026-09-08T12:00:00.000Z",
    );
    assert.ok(c);
    assert.equal(c!.kind, "SOURCE_CONFLICT");
    assert.equal(c!.field, "kickoff_utc");
  });

  it("market normalize + available_at never invents published_at", () => {
    const m = marketNormalize054("Over 2,5");
    assert.equal(m.market_type, "TOTALS");
    assert.equal(m.line, 2.5);
    assert.equal(m.selection, "OVER");
    assert.equal(m.source_market_label, "Over 2,5");
    assert.equal(availableAt054({ source_published_at: null, ingested_at: "ING" }), "ING");
    assert.equal(availableAt054({ source_published_at: "PUB", ingested_at: "ING" }), "PUB");
  });

  it("unmatched when sports differ", () => {
    const m = matchEvents054({
      sport_a: "tennis",
      sport_b: "soccer",
      p1_a: "A",
      p2_a: "B",
      p1_b: "A",
      p2_b: "B",
      kickoff_a: null,
      kickoff_b: null,
    });
    assert.equal(m.class, "MATCH_UNMATCHED");
  });

  it("Lab A fingerprint + audit READY shape", () => {
    const before = labAFingerprint046();
    assert.equal(before.events, 114);
    assertLabAUntouched046(before);
    const r = auditTask054({
      experiment_id: "exp_054_directa_multisource_catalog",
      task: "054",
      FINAL_VERDICT: "DIRECTA_MULTISOURCE_CATALOG_READY",
      DIRECTA_STATUS: "DISABLED_BY_POLICY",
      DIRECTA_POLICY_STATUS: "DISABLED_BY_POLICY",
      TOTAL_EVENTS: 400,
      UNIQUE_EVENTS: 385,
      TODAY: 10,
      NEXT_24H: 20,
      NEXT_72H: 40,
      NEXT_7D: 80,
      CATALOG: 385,
      ODDS_AVAILABLE: 385,
      ODDS_MISSING: 0,
      MATCHED: 0,
      UNMATCHED: 0,
      CONFLICTS: 0,
      ANALYZED: 300,
      PAPER_BANKROLL: 1000,
      REAL_MONEY: false,
      MODEL_EDGE: "UNKNOWN",
      CAPITAL: "PAPER_ONLY",
      ARTIFICIAL_CAP: false,
      LAB_A_MUTATION: false,
      LAB_A_EVENTS: 114,
      LAB_A_LOCKED: 114,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      CURRENT_ACTIVITY: "IDLE",
      OBSERVATORY_API_CALLS_UI: 0,
      open_task_055: false,
      fingerprint: "x",
      experiment_sha256: "y",
    });
    assert.equal(r.ok, true);
  });

  it("rate-limit queue respects min interval and opens circuit", async () => {
    const { createDirectaQueue054 } = await import("@/services/sources/directa/rate-limit");
    const q = createDirectaQueue054({
      min_interval_ms: 20,
      max_concurrency: 1,
      max_retries: 0,
      timeout_ms: 500,
    });
    const t0 = Date.now();
    await q.run(async () => "a");
    await q.run(async () => "b");
    assert.ok(Date.now() - t0 >= 15);
    for (let i = 0; i < 5; i++) {
      try {
        await q.run(async () => {
          throw new Error("500 boom");
        });
      } catch {
        /* expected */
      }
    }
    assert.equal(q.state.circuit_open, true);
  });

  it("multi-bookmaker triangulation", async () => {
    const { triangulateOdds054 } = await import("@/domain/eval/catalog-054/triangulation");
    const t = triangulateOdds054([
      {
        source: "ODDS_API",
        bookmaker: "a",
        market: "h2h",
        selection: "home",
        line: null,
        price: 2.0,
        available_at: "t",
      },
      {
        source: "DIRECTA",
        bookmaker: "b",
        market: "h2h",
        selection: "home",
        line: null,
        price: 2.2,
        available_at: "t",
      },
    ]);
    assert.ok(t);
    assert.equal(t!.best_bookmaker, "b");
    assert.equal(t!.bookmaker_count, 2);
    assert.equal(t!.min_odds, 2);
    assert.equal(t!.max_odds, 2.2);
  });
});
