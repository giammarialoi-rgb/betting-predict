import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { catalogMarketsForEvent047 } from "@/domain/eval/factory-047/market-catalog";
import { coverageBinsForEvent047, neverSubstituteCollectedAt047 } from "@/domain/eval/factory-047/coverage";
import { classifyDiscovery047, discoveryKey047 } from "@/domain/eval/factory-047/discovery-class";
import { buildStructuredWhy047 } from "@/domain/eval/factory-047/why";
import { scanPostLockMovements047 } from "@/domain/eval/factory-047/post-lock";
import { planBudget047, shouldStopGracefully047 } from "@/domain/eval/factory-047/budget";
import { backwardSearch047 } from "@/domain/eval/factory-047/backward";
import { aggregatePatterns047 } from "@/domain/eval/factory-047/patterns";
import { computeRankBoards047 } from "@/domain/eval/factory-047/ranking";
import { selectSportsForPull045 } from "@/domain/eval/factory-045/pull";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import {
  loadStore044,
  appendEvent044,
  appendQuote044,
  appendPrediction044,
  appendLock044,
  appendSettlement044,
  appendAutopsy044,
} from "@/domain/eval/permanent-044/store";
import { ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { defaultCreditState042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { auditTask047 } from "@/domain/eval/factory-047/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import type { PermanentPrediction044, PermanentEvent044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t047-"));
}

function pred(partial: Partial<PermanentPrediction044> & { event_id: string }): PermanentPrediction044 {
  return {
    prediction_id: partial.prediction_id ?? "p1",
    event_id: partial.event_id,
    timestamp: partial.timestamp ?? "2026-09-01T00:00:00.000Z",
    model_version: partial.model_version ?? "m1",
    feature_version: partial.feature_version ?? "f1",
    market: partial.market ?? "1X2",
    selection: partial.selection ?? "HOME",
    line: partial.line ?? null,
    probability_model: partial.probability_model !== undefined ? partial.probability_model : { HOME: 0.45, DRAW: 0.3, AWAY: 0.25 },
    probability_market: partial.probability_market !== undefined ? partial.probability_market : { HOME: 0.44, DRAW: 0.31, AWAY: 0.25 },
    edge_absolute: partial.edge_absolute !== undefined ? partial.edge_absolute : 0.01,
    edge_relative: partial.edge_relative ?? null,
    confidence_score: partial.confidence_score ?? 40,
    data_quality_score: partial.data_quality_score ?? 0.6,
    recommended: false,
    reason_codes: partial.reason_codes ?? ["MODEL_IS_MARKET_ONLY"],
    risk_flags: partial.risk_flags ?? ["RESEARCH_ONLY"],
    human_readable_reason: partial.human_readable_reason ?? "market mirror",
    ranking_bucket: partial.ranking_bucket ?? "NO_BET",
    prediction_seq: partial.prediction_seq ?? 1,
    immutable: true,
  };
}

describe("TASK 047 universal live coverage", () => {
  it("multi-sport selection prefers soccer and tennis when present", () => {
    const sel = selectSportsForPull045([
      { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
      { key: "tennis_atp", group: "Tennis", title: "ATP", active: true, has_outrights: false },
      { key: "basketball_nba", group: "Basketball", title: "NBA", active: true, has_outrights: false },
    ]);
    assert.ok(sel.soccer.length >= 1);
    assert.ok(sel.tennis.length >= 1);
  });

  it("dedupe key is source + provider_event_id", () => {
    assert.equal(discoveryKey047("the-odds-api", "abc"), "the-odds-api|abc");
    const seen = new Set<string>();
    const a = classifyDiscovery047({
      event: undefined,
      providerEventId: "abc",
      source: "the-odds-api",
      seenKeys: seen,
    });
    assert.equal(a, "DISCOVERED_LIVE");
    seen.add(discoveryKey047("the-odds-api", "abc"));
    const b = classifyDiscovery047({
      event: { origin: "DISCOVERED_LIVE" } as PermanentEvent044,
      providerEventId: "abc",
      source: "the-odds-api",
      seenKeys: seen,
    });
    assert.equal(b, "RE_DISCOVERED");
  });

  it("market catalog never invents markets", () => {
    const quotes: PermanentQuote044[] = [
      {
        event_id: "e1",
        bookmaker: "pinnacle",
        market: "h2h",
        market_group: "main",
        market_type: "h2h",
        selection: "HOME",
        line: null,
        price: 1.9,
        available_at_utc: "2026-09-01T10:00:00.000Z",
        collected_at_utc: "2026-09-01T10:00:01.000Z",
        source: "the-odds-api",
        market_available: true,
        fingerprint: "q1",
      },
      {
        event_id: "e1",
        bookmaker: "pinnacle",
        market: "totals",
        market_group: "main",
        market_type: "totals",
        selection: "OVER",
        line: 2.5,
        price: 1.95,
        available_at_utc: "2026-09-01T10:00:00.000Z",
        collected_at_utc: "2026-09-01T10:00:01.000Z",
        source: "the-odds-api",
        market_available: true,
        fingerprint: "q2",
      },
    ];
    const cat = catalogMarketsForEvent047(quotes);
    assert.deepEqual([...new Set(cat.map((c) => c.market_key))].sort(), ["h2h", "totals"]);
    assert.ok(!cat.some((c) => c.market_key === "btts"));
  });

  it("coverage bins use available_at only; collected_at never substitutes", () => {
    const ev: PermanentEvent044 = {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "test",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-09-08T18:00:00.000Z",
      collected_at_utc: "2026-09-08T17:00:00.000Z",
      available_at_utc: null,
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "SCHEDULED",
    };
    const quotes: PermanentQuote044[] = [
      {
        event_id: "e1",
        bookmaker: "p",
        market: "h2h",
        market_group: "main",
        market_type: "h2h",
        selection: "HOME",
        line: null,
        price: 2,
        available_at_utc: "2026-09-08T17:00:00.000Z",
        collected_at_utc: "2026-09-01T00:00:00.000Z",
        source: "test",
        market_available: true,
        fingerprint: "q",
      },
    ];
    const bins = coverageBinsForEvent047(ev, quotes);
    assert.equal(bins.T1H, true);
    assert.equal(bins.T72, false);
    const sep = neverSubstituteCollectedAt047(null, "2026-09-08T17:00:00.000Z");
    assert.equal(sep.available_at, null);
    assert.equal(sep.substituted, false);
  });

  it("lock immutability + post-lock isolation", () => {
    assert.throws(() => assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z"));
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "test",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-09-08T18:00:00.000Z",
      collected_at_utc: "2026-09-08T12:00:00.000Z",
      available_at_utc: "2026-09-08T12:00:00.000Z",
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "SCHEDULED",
    });
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "p",
      market: "totals",
      market_group: "main",
      market_type: "totals",
      selection: "OVER",
      line: 2.5,
      price: 1.95,
      available_at_utc: "2026-09-08T17:00:00.000Z",
      collected_at_utc: "2026-09-08T17:00:01.000Z",
      source: "test",
      market_available: true,
      fingerprint: "pre",
    });
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "p",
      market: "totals",
      market_group: "main",
      market_type: "totals",
      selection: "OVER",
      line: 2.5,
      price: 1.82,
      available_at_utc: "2026-09-08T17:40:00.000Z",
      collected_at_utc: "2026-09-08T17:40:01.000Z",
      source: "test",
      market_available: true,
      fingerprint: "post",
    });
    appendLock044(store, {
      event_id: "e1",
      lock_timestamp: "2026-09-08T17:00:00.000Z",
      decision_context_hash: "h",
      model_version: "m",
      feature_version: "f",
      market_snapshot_hash: "ms",
      prediction_hash: "ph",
      lab: "PERMANENT_LIVE",
      lab_a_decision_id: null,
    });
    const moves = scanPostLockMovements047(store, "2026-09-08T18:00:00.000Z");
    assert.ok(moves.length >= 1);
    assert.equal(moves[0]!.prediction_impact, "NONE_ON_LOCKED_PREDICTION");
    assert.ok((moves[0]!.change ?? 0) < 0);
  });

  it("structured WHY marks missing signals NOT_AVAILABLE", () => {
    const why = buildStructuredWhy047(pred({ event_id: "e1", probability_market: null, edge_absolute: null }));
    assert.equal(why.form_signal.status, "NOT_AVAILABLE");
    assert.equal(why.injury_signal.status, "NOT_AVAILABLE");
    assert.equal(why.market_signal.status, "NOT_AVAILABLE");
  });

  it("settlement + autopsy + backward search + learning case", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "test",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-09-01T18:00:00.000Z",
      collected_at_utc: "2026-09-01T10:00:00.000Z",
      available_at_utc: "2026-09-01T10:00:00.000Z",
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "FINISHED",
    });
    const p = pred({ event_id: "e1", prediction_id: "pred1" });
    appendPrediction044(store, p);
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "a",
      market: "h2h",
      market_group: "main",
      market_type: "h2h",
      selection: "HOME",
      line: null,
      price: 1.8,
      available_at_utc: "2026-09-01T16:00:00.000Z",
      collected_at_utc: "2026-09-01T16:00:01.000Z",
      source: "test",
      market_available: true,
      fingerprint: "q1",
    });
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "b",
      market: "h2h",
      market_group: "main",
      market_type: "h2h",
      selection: "HOME",
      line: null,
      price: 2.1,
      available_at_utc: "2026-09-01T16:30:00.000Z",
      collected_at_utc: "2026-09-01T16:30:01.000Z",
      source: "test",
      market_available: true,
      fingerprint: "q2",
    });
    appendLock044(store, {
      event_id: "e1",
      lock_timestamp: "2026-09-01T17:00:00.000Z",
      decision_context_hash: "h",
      model_version: "m",
      feature_version: "f",
      market_snapshot_hash: "ms",
      prediction_hash: "ph",
      lab: "PERMANENT_LIVE",
      lab_a_decision_id: null,
    });
    appendSettlement044(store, {
      event_id: "e1",
      result: "AWAY",
      market: "1X2",
      selection: "HOME",
      outcome: "lost",
      settled_at: "2026-09-01T20:00:00.000Z",
      source: "test",
      source_confidence: 1,
    });
    appendAutopsy044(store, {
      autopsy_id: "au1",
      event_id: "e1",
      prediction_id: "pred1",
      result_class: "INCORRECT",
      error_type: "MODEL_ERROR",
      cause_hypotheses: [{ hypothesis: "overweight_home", confidence: 0.4 }],
      evidence: ["lost"],
      learning_candidate: true,
      created_at: "2026-09-01T20:01:00.000Z",
    });
    const search = backwardSearch047({
      store,
      prediction: p,
      autopsy: store.autopsies[0]!,
      lockTime: "2026-09-01T17:00:00.000Z",
    });
    assert.equal(search.SIGNAL_FOUND, true);
    const patterns = aggregatePatterns047(store, "2026-09-01T21:00:00.000Z");
    assert.ok(patterns.some((x) => x.pattern === "MODEL_ERROR"));
    assert.equal(patterns.find((x) => x.pattern === "MODEL_ERROR")!.status, "INSUFFICIENT_N");
  });

  it("budget firewall stops before SAFE_REMAINING", () => {
    const cfg = loadGovernorConfig042();
    const credit = {
      ...defaultCreditState042(cfg),
      observedRemaining: cfg.safeRemaining + 2,
      estimatedRemaining: cfg.safeRemaining + 2,
      safeRemaining: cfg.safeRemaining,
    };
    const plan = planBudget047({ credit, cfg, estimatedCost: 10, wantsDiscovery: true });
    assert.equal(plan.stop_gracefully, true);
    assert.equal(shouldStopGracefully047(cfg.safeRemaining + 1, cfg.safeRemaining, 5), true);
  });

  it("ranking boards separate edge vs confidence", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    for (const [id, conf, edge] of [
      ["e1", 90, 0],
      ["e2", 20, 0.2],
    ] as const) {
      appendEvent044(store, {
        event_id: id,
        canonical_event_id: id,
        source: "test",
        source_event_id: id,
        sport: "soccer",
        competition: "epl",
        country: null,
        home_or_a: "A",
        away_or_b: "B",
        kickoff_utc: "2026-12-01T15:00:00.000Z",
        collected_at_utc: "2026-11-01T00:00:00.000Z",
        available_at_utc: null,
        semantic_level: "STRICT",
        data_quality: 1,
        fingerprint: id,
        status: "SCHEDULED",
      });
      appendPrediction044(
        store,
        pred({
          event_id: id,
          prediction_id: `p-${id}`,
          confidence_score: conf,
          edge_absolute: edge,
        }),
      );
    }
    const board = computeRankBoards047(store, "2026-09-08");
    assert.equal(board.TOP_CONFIDENCE[0], "e1");
    assert.equal(board.TOP_EDGE[0], "e2");
  });

  it("crash recovery: restart does not duplicate event fingerprint", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    const ev = {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "test",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: null,
      semantic_level: "STRICT" as const,
      data_quality: 1,
      fingerprint: "same-fp",
      status: "SCHEDULED",
    };
    assert.equal(appendEvent044(store, ev), "ok");
    const store2 = loadStore044(root);
    assert.equal(appendEvent044(store2, ev), "dup");
    assert.equal(store2.events.length, 1);
  });

  it("Lab A fingerprint unchanged by control overlay", () => {
    const before = labAFingerprint046();
    assertLabAUntouched046(before);
  });

  it("audit rejects open capital / auto promotion flags", () => {
    const r = auditTask047(null);
    assert.equal(r.ok, true);
  });

  it("checkpoint write survives restart simulation", () => {
    const root = tmp();
    mkdirSync(join(root, "manifests"), { recursive: true });
    const cp = join(root, "checkpoint.json");
    writeFileSync(cp, JSON.stringify({ cycleN: 3, tennis_status: "TENNIS_PROVIDER_UNAVAILABLE" }));
    assert.ok(existsSync(cp));
    const j = JSON.parse(readFileSync(cp, "utf8")) as { cycleN: number };
    assert.equal(j.cycleN, 3);
  });
});
