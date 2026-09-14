import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { appendDecision039, appendQuote039, loadStore039, upsertEvent039 } from "@/domain/eval/live-039/store";
import { applyScores039 } from "@/domain/eval/live-039/settle";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { assertNoPostLockMutation044, classifyVsLock044 } from "@/domain/eval/permanent-044/firewall";
import { canonicalEventId044 } from "@/domain/eval/permanent-044/normalize";
import { whyThisPrediction044 } from "@/domain/eval/permanent-044/why-prediction";
import { simulateTarget044 } from "@/domain/eval/permanent-044/target-simulator";
import { normalizeMarketType044 } from "@/domain/eval/permanent-044/taxonomy";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t044-"));
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
        raw_payload_hash: `${book}-${outcome}`,
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
    bookmaker: "consensus",
    observation_ids: [],
    decision_context_hash: "hash1",
    observation_only: true,
  });
}

describe("task-044 permanent live / total intelligence", () => {
  it("analyzes every event, locks Lab B only, append-only predictions", async () => {
    const labA = tmp();
    const labB = tmp();
    seed(labA);
    const before = loadStore039(labA).decisions.length;
    const r = await runPermanent044Cycle({
      labARoot: labA,
      permanentRoot: labB,
      runCollector042: false,
      nowIso: "2026-09-15T12:00:00.000Z",
    });
    assert.equal(loadStore039(labA).decisions.length, before);
    const store = loadStore044(labB);
    assert.equal(store.events.length, 1);
    assert.ok(store.predictions.length >= 1);
    assert.equal(store.locks.length, 1);
    assert.equal(store.predictions[0]!.recommended, false);
    assert.ok(whyThisPrediction044(store.predictions[0]!).final_motivation.length > 10);
    assert.ok(r.predictionsWritten >= 1);
  });

  it("rejects post-lock mutation and classifies info", () => {
    assert.throws(() => assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z"));
    assert.equal(
      classifyVsLock044({ available_at: "2026-01-01T13:00:00.000Z", lock_time: "2026-01-01T12:00:00.000Z" }),
      "INFORMATION_AVAILABLE_AFTER_LOCK",
    );
    assert.equal(
      classifyVsLock044({ available_at: "2026-01-01T11:00:00.000Z", lock_time: "2026-01-01T12:00:00.000Z" }),
      "INFORMATION_AVAILABLE_BEFORE_LOCK",
    );
  });

  it("settlement autopsy is POST_EVENT and does not change Lab A lock hash", async () => {
    const labA = tmp();
    const labB = tmp();
    seed(labA);
    await runPermanent044Cycle({ labARoot: labA, permanentRoot: labB, runCollector042: false });
    const hashBefore = loadStore039(labA).decisions[0]!.decision_context_hash;
    const storeA = loadStore039(labA);
    applyScores039(
      storeA,
      [
        {
          source_event_id: "s1",
          home_team: "A",
          away_team: "B",
          commence_time: "2026-10-01T16:00:00.000Z",
          completed: true,
          home_score: 2,
          away_score: 1,
        },
      ],
      "2026-10-01T18:00:00.000Z",
      "test",
    );
    await runPermanent044Cycle({ labARoot: labA, permanentRoot: labB, runCollector042: false });
    assert.equal(loadStore039(labA).decisions[0]!.decision_context_hash, hashBefore);
    const store = loadStore044(labB);
    assert.ok(store.autopsies.length >= 1);
    assert.ok(store.settlements.length >= 1);
  });

  it("canonical ids stable; market taxonomy; target simulator honest", () => {
    const a = canonicalEventId044({
      sport: "soccer",
      competition: "soccer_epl",
      home: "A",
      away: "B",
      kickoff_utc: "2026-10-01T16:00:00.000Z",
    });
    const b = canonicalEventId044({
      sport: "soccer",
      competition: "soccer_epl",
      home: "A",
      away: "B",
      kickoff_utc: "2026-10-01T16:00:00.000Z",
    });
    assert.equal(a, b);
    assert.equal(normalizeMarketType044("1X2", "soccer").market_type, "1X2");
    assert.equal(normalizeMarketType044("h2h", "tennis").market_type, "MATCH_WINNER");
    const sim = simulateTarget044({ capital: 10, target_profit: 3000, time_window_days: 7, risk_tolerance: "high" });
    assert.equal(sim.reachable_claim, "VERY_UNLIKELY");
    assert.match(sim.disclaimer, /REAL_MONEY=false/);
  });

  it("duplicate quotes/events fingerprint-safe", async () => {
    const labA = tmp();
    const labB = tmp();
    seed(labA);
    await runPermanent044Cycle({ labARoot: labA, permanentRoot: labB, runCollector042: false });
    const r2 = await runPermanent044Cycle({ labARoot: labA, permanentRoot: labB, runCollector042: false });
    assert.equal(r2.eventsInserted, 0);
    assert.equal(r2.quotesInserted, 0);
  });
});
