import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { appendDecision039, appendQuote039, loadStore039, upsertEvent039 } from "@/domain/eval/live-039/store";
import { applyScores039 } from "@/domain/eval/live-039/settle";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { ProspectiveIntegrityError } from "@/domain/eval/prospective-036/integrity";
import { admitFeature043 } from "@/domain/eval/live-043/features";
import { triangulateMarket043 } from "@/domain/eval/live-043/triangulation";
import { candidateGate043 } from "@/domain/eval/live-043/predict";
import { runLive043Cycle } from "@/domain/eval/live-043/cycle";
import { loadStore043 } from "@/domain/eval/live-043/store";
import { auditTask043 } from "@/domain/eval/live-043/audit";
import { runTask043 } from "@/domain/eval/live-043/lab";
import { proposeNextModel043 } from "@/domain/eval/live-043/learning";
import { loadModelRegistry043 } from "@/domain/eval/live-043/store";
import { canAffordRun042, defaultCreditState042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t043-"));
}

function seed(root: string) {
  const store = loadStore039(root);
  upsertEvent039(store, {
    event_id: "e1",
    source_event_id: "s1",
    sport_key: "soccer_epl",
    home_team: "A",
    away_team: "B",
    commence_time: "2026-10-01T16:00:00.000Z",
    source: "the-odds-api",
    first_seen_at: "2026-09-01T00:00:00.000Z",
    last_seen_at: "2026-09-01T00:00:00.000Z",
    kickoff_status: "OK",
  });
  for (const [book, home] of [
    ["pinnacle", 1.9],
    ["bet365", 2.0],
  ] as const) {
    for (const [outcome, price] of [
      ["HOME", home],
      ["DRAW", 3.4],
      ["AWAY", 4.0],
    ] as const) {
      appendQuote039(store, {
        event_id: "e1",
        market: "1X2",
        bookmaker: book,
        outcome,
        price,
        source_quote_timestamp: "2026-10-01T14:00:00.000Z",
        collected_at: "2026-10-01T14:00:01.000Z",
        available_at: "2026-10-01T14:00:00.000Z",
        raw_payload_hash: "x",
        temporal_class: "STRICT",
        match_status: "MATCH_EXACT",
        window: "T-1h",
        offset_seconds_from_kickoff: 7200,
        coverage_status: "COVERED",
      });
    }
  }
  appendDecision039(store, {
    decision_id: "d1",
    event_id: "e1",
    decision_timestamp_utc: "2026-10-01T15:00:00.000Z",
    window: "T-1h",
    state: "LOCKED",
    market: "1X2",
    home_raw: 0.45,
    draw_raw: 0.3,
    away_raw: 0.25,
    home_devig: 0.45,
    draw_devig: 0.3,
    away_devig: 0.25,
    overround: 1.05,
    bookmaker: "pinnacle",
    observation_ids: [],
    decision_context_hash: "h",
    observation_only: true,
  });
  return store;
}

describe("TASK 043 total live lab", () => {
  it("feature blocked when available_at after asOf", () => {
    assert.equal(admitFeature043("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z"), "FEATURE_BLOCKED");
    assert.equal(admitFeature043(null, "2026-10-01T15:00:00.000Z"), "FEATURE_BLOCKED");
    assert.equal(admitFeature043("2026-10-01T14:00:00.000Z", "2026-10-01T15:00:00.000Z"), "OK");
  });

  it("LOCK immutable", () => {
    assert.throws(
      () =>
        mutateDecision(
          {
            decision_id: "d",
            event_id: "e",
            decision_timestamp_utc: "2026-10-01T15:00:00.000Z",
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
        ),
      (e) => e instanceof ProspectiveIntegrityError,
    );
  });

  it("triangulation + candidate gate market-only = NO_SIGNAL", () => {
    const root = tmp();
    const store = seed(root);
    const tri = triangulateMarket043({
      eventId: "e1",
      market: "1X2",
      sportKey: "soccer_epl",
      quotes: store.quotes,
      asOf: "2026-10-01T15:00:00.000Z",
    });
    assert.equal(tri.status, "OK");
    assert.ok((tri.n_books ?? 0) >= 2);
    const gate = candidateGate043({
      model: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      market: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      delta: { HOME: 0, DRAW: 0, AWAY: 0 },
      dataQuality: 0.8,
      modelConfidence: 0.8,
      marketOnly: true,
    });
    assert.equal(gate.class, "NO_SIGNAL");
    assert.equal(gate.edgeCandidate, false);
  });

  it("cycle builds prediction for every event without API", async () => {
    const src = tmp();
    const art = tmp();
    seed(src);
    const r = await runLive043Cycle({ sourceRoot: src, artifactRoot: art, runCollector042: false });
    assert.equal(r.catalogInserted, 1);
    assert.ok(r.analyzed + r.partial >= 1);
    assert.equal(r.lockedFormal, 1);
    const s043 = loadStore043(art);
    assert.equal(s043.predictions.length, 1);
    assert.equal(s043.predictions[0]!.locked, true);
  });

  it("does not mutate existing LOCK on re-run", async () => {
    const src = tmp();
    const art = tmp();
    seed(src);
    await runLive043Cycle({ sourceRoot: src, artifactRoot: art, runCollector042: false });
    const before = loadStore039(src).decisions[0]!.decision_context_hash;
    await runLive043Cycle({ sourceRoot: src, artifactRoot: art, runCollector042: false });
    assert.equal(loadStore039(src).decisions[0]!.decision_context_hash, before);
  });

  it("settlement after kickoff + autopsy learning candidate", async () => {
    const src = tmp();
    const art = tmp();
    const store = seed(src);
    applyScores039(
      store,
      [
        {
          source_event_id: "s1",
          home_team: "A",
          away_team: "B",
          commence_time: "2026-10-01T16:00:00.000Z",
          completed: true,
          home_score: 1,
          away_score: 0,
        },
      ],
      "2026-10-01T18:00:00.000Z",
      "test",
    );
    const r = await runLive043Cycle({ sourceRoot: src, artifactRoot: art, runCollector042: false });
    assert.ok(r.autopsies >= 1);
    assert.ok(r.learningCandidates >= 0);
  });

  it("proposed model is not production / no retro", () => {
    const reg = loadModelRegistry043(tmp());
    const next = proposeNextModel043({
      registry: reg,
      trainingCutoff: "2026-09-01T00:00:00.000Z",
      trainingEvents: 10,
      validationEvents: 5,
      features: ["MARKET"],
      fingerprint: "abc",
    });
    assert.equal(next.versions.at(-1)!.production, false);
    assert.equal(reg.current_version, "MODEL_v1");
  });

  it("credit budget gate still works", () => {
    const cfg = { ...loadGovernorConfig042(), safeRemaining: 100, maxCreditsPerRun: 20 };
    const st = { ...defaultCreditState042(cfg), observedRemaining: 50 };
    assert.equal(canAffordRun042(st, 5, cfg).ok, false);
  });

  it("lab audit capital closed", async () => {
    const src = tmp();
    const art = tmp();
    seed(src);
    const report = await runTask043({ sourceRoot: src, artifactRoot: art, runCollector042: false });
    assert.equal(report.BETS, 0);
    assert.equal(report.BANKROLL, "—");
    assert.equal(report.CAPITAL_QUALIFIED, false);
    assert.notEqual(report.FINAL_VERDICT, "EDGE_DEMONSTRATED");
    assert.equal(auditTask043(report).ok, true);
  });
});
