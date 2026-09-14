import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { selectSportsByFamily049, resolveFamilyForKey049, SPORT_FAMILY_ADAPTERS_049 } from "@/domain/eval/factory-049/adapters";
import { analyzeEventMarkets049 } from "@/domain/eval/factory-049/multi-market";
import { computeMassiveStats049 } from "@/domain/eval/factory-049/stats";
import { auditTask049 } from "@/domain/eval/factory-049/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { planBudget047 } from "@/domain/eval/factory-047/budget";
import { defaultCreditState042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import {
  loadStore044,
  appendEvent044,
  appendQuote044,
  appendPrediction044,
} from "@/domain/eval/permanent-044/store";
import { ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t049-"));
}

describe("TASK 049 massive multi-sport lab", () => {
  it("adapters cover soccer tennis basketball volleyball hockey and are extensible", () => {
    assert.ok(SPORT_FAMILY_ADAPTERS_049.some((a) => a.family === "soccer"));
    assert.ok(SPORT_FAMILY_ADAPTERS_049.some((a) => a.family === "tennis"));
    assert.ok(SPORT_FAMILY_ADAPTERS_049.some((a) => a.family === "basketball"));
    assert.ok(SPORT_FAMILY_ADAPTERS_049.some((a) => a.family === "volleyball"));
    assert.ok(SPORT_FAMILY_ADAPTERS_049.some((a) => a.family === "hockey"));
    assert.equal(resolveFamilyForKey049("basketball_nba")?.family, "basketball");
    assert.equal(resolveFamilyForKey049("icehockey_nhl")?.family, "hockey");
    assert.equal(resolveFamilyForKey049("volleyball_italy_serie_a")?.family, "volleyball");
  });

  it("PROVIDER_UNAVAILABLE when family has zero active keys — not world-absent", () => {
    const sel = selectSportsByFamily049([
      { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
    ]);
    const tennis = sel.families.find((f) => f.family === "tennis")!;
    assert.equal(tennis.status, "PROVIDER_UNAVAILABLE");
    assert.match(tennis.note!, /PROVIDER_UNAVAILABLE/);
    assert.equal(sel.families.find((f) => f.family === "soccer")!.status, "AVAILABLE");
  });

  it("no artificial cap: pull queue includes all active keys in priority families", () => {
    const keys = Array.from({ length: 40 }, (_, i) => ({
      key: `soccer_league_${i}`,
      group: "Soccer",
      title: `L${i}`,
      active: true,
      has_outrights: false,
    }));
    keys.push(
      { key: "basketball_nba", group: "Basketball", title: "NBA", active: true, has_outrights: false },
      { key: "tennis_atp", group: "Tennis", title: "ATP", active: true, has_outrights: false },
    );
    const sel = selectSportsByFamily049(keys);
    assert.ok(sel.pullQueue.length >= 42);
    assert.ok(sel.pullQueue.some((p) => p.family === "basketball"));
  });

  it("multi-market board only uses observed markets", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "t",
      source_event_id: "s1",
      sport: "soccer",
      competition: "soccer_epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: "2026-11-01T00:00:00.000Z",
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "SCHEDULED",
    });
    for (const [market, sel, price] of [
      ["1X2", "HOME", 1.9],
      ["OU", "OVER", 1.85],
    ] as const) {
      appendQuote044(store, {
        event_id: "e1",
        bookmaker: "p",
        market,
        market_group: "main",
        market_type: market,
        selection: sel,
        line: market === "OU" ? 2.5 : null,
        price,
        available_at_utc: "2026-11-30T14:00:00.000Z",
        collected_at_utc: "2026-11-30T14:00:01.000Z",
        source: "t",
        market_available: true,
        fingerprint: `${market}-${sel}`,
      });
    }
    const board = analyzeEventMarkets049(store, "e1", "2026-11-30T14:00:00.000Z");
    assert.ok(board);
    assert.deepEqual(board!.markets_analyzed.map((m) => m.market).sort(), ["1X2", "OU"]);
    assert.ok(!board!.markets_analyzed.some((m) => m.market === "BTTS"));
    assert.ok(board!.best_market);
  });

  it("stats report no artificial cap and sport breakdown", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "t",
      source_event_id: "s1",
      sport: "basketball",
      competition: "basketball_nba",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: null,
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "SCHEDULED",
    });
    appendPrediction044(store, {
      prediction_id: "p1",
      event_id: "e1",
      timestamp: "2026-11-01T00:00:00.000Z",
      model_version: "MODEL_v2_DECISION_ENGINE",
      feature_version: "f1",
      market: "1X2",
      selection: "HOME",
      line: null,
      probability_model: { HOME: 0.5, AWAY: 0.5 },
      probability_market: { HOME: 0.5, AWAY: 0.5 },
      edge_absolute: 0,
      edge_relative: null,
      confidence_score: 40,
      data_quality_score: 0.5,
      recommended: false,
      reason_codes: ["MODEL_IS_MARKET_ONLY"],
      risk_flags: ["RESEARCH_ONLY"],
      human_readable_reason: "t",
      ranking_bucket: "NO_BET",
      prediction_seq: 1,
      immutable: true,
    });
    const stats = computeMassiveStats049(store);
    assert.equal(stats.artificial_cap, false);
    assert.equal(stats.BASKETBALL, 1);
    assert.match(stats.catalog_note, /NOT A CATALOG CAP/);
  });

  it("lock immutability + budget stop", () => {
    assert.throws(() => assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z"));
    const cfg = loadGovernorConfig042();
    const credit = {
      ...defaultCreditState042(cfg),
      observedRemaining: cfg.safeRemaining + 1,
      estimatedRemaining: cfg.safeRemaining + 1,
      safeRemaining: cfg.safeRemaining,
    };
    assert.equal(planBudget047({ credit, cfg, estimatedCost: 30, wantsDiscovery: true }).stop_gracefully, true);
  });

  it("Lab A fingerprint unchanged", () => {
    const before = labAFingerprint046();
    assertLabAUntouched046(before);
  });

  it("audit config flags", () => {
    assert.equal(auditTask049(null).ok, true);
  });
});
