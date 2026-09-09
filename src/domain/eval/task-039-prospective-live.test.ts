import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { AdapterPull036 } from "@/domain/eval/prospective-036/adapter";
import { hasUtcOffset, isDateOnly, parseExactUtcMs, requireExactUtc } from "@/domain/eval/prospective-036/clocks";
import { assertQuoteBeforeKickoff } from "@/domain/eval/prospective-036/integrity";
import { createFixtureAdapter, createOddsApiAdapter, hashRawJson036, parseOddsApiPayload, unavailablePull } from "@/domain/eval/prospective-036/sources";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { ProspectiveIntegrityError } from "@/domain/eval/prospective-036/integrity";
import { auditTask039 } from "@/domain/eval/live-039/audit";
import { binCoverage039, lastAtOrBeforeCutoff039, observationWindow039, t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { availableAt039, classifyQuote039, matchGrade039 } from "@/domain/eval/live-039/classify";
import { clv039 } from "@/domain/eval/live-039/clv";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import { loadExp039Config } from "@/domain/eval/live-039/config";
import { fingerprint039, runTask039 } from "@/domain/eval/live-039/lab";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { applyScores039, assertRevealAfterLock039, outcomeFromScores039 } from "@/domain/eval/live-039/settle";
import { failureMode039, parseOddsApiScores } from "@/domain/eval/live-039/sources";
import { quoteKey039 } from "@/domain/eval/live-039/store";
import type { Quote039 } from "@/domain/eval/live-039/types";

function tmpStore(): string {
  return mkdtempSync(join(tmpdir(), "task039-"));
}

function okPull(over: Partial<AdapterPull036> = {}): AdapterPull036 {
  const events = [
    {
      source_event_id: "e1",
      competition: "soccer_epl",
      season: "2026",
      home_team: "Arsenal",
      away_team: "Chelsea",
      kickoff_at_utc: "2026-10-03T16:00:00.000Z",
    },
  ];
  const quotes = [
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "HOME",
      odds_decimal: 1.9,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|HOME",
      source_timestamp_utc: "2026-10-03T15:00:00.000Z",
    },
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "DRAW",
      odds_decimal: 3.5,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|DRAW",
      source_timestamp_utc: "2026-10-03T15:00:00.000Z",
    },
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "AWAY",
      odds_decimal: 4.2,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|AWAY",
      source_timestamp_utc: "2026-10-03T15:00:00.000Z",
    },
  ];
  return {
    source: "the-odds-api",
    status: "ok",
    error: null,
    requested_at_utc: "2026-10-03T15:00:01.000Z",
    received_at_utc: "2026-10-03T15:00:01.000Z",
    provenance: "the-odds-api live",
    events,
    quotes,
    ...hashRawJson036({ events, quotes }),
    ...over,
  };
}

function q(over: Partial<Quote039> = {}): Quote039 {
  return {
    event_id: "e1",
    market: "1X2",
    bookmaker: "pinnacle",
    outcome: "HOME",
    price: 1.9,
    source_quote_timestamp: "2026-10-03T15:00:00.000Z",
    collected_at: "2026-10-03T15:00:01.000Z",
    available_at: "2026-10-03T15:00:00.000Z",
    raw_payload_hash: "abc",
    temporal_class: "STRICT",
    match_status: "MATCH_EXACT",
    window: "T-1h",
    offset_seconds_from_kickoff: 3600,
    coverage_status: "COVERED",
    ...over,
  };
}

describe("TASK 039 prospective live pipeline", () => {
  it("A B key missing vs present", async () => {
    const missing = await runTask039({ storeRoot: tmpStore(), livePull: false });
    assert.equal(missing.FINAL_VERDICT, "LIVE_NOT_CONFIGURED");
    assert.equal(missing.COLLECTION_STATUS, "BLOCKED");
    assert.equal(missing.API_KEY_CONFIGURED, false);
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T15:00:01.000Z",
    });
    const present = await runTask039({
      storeRoot: root,
      adapters: [createFixtureAdapter(okPull())],
      livePull: false,
    });
    assert.equal(present.API_KEY_CONFIGURED, true);
    assert.equal(present.STRICT_EVENTS, 1);
    assert.notEqual(present.FINAL_VERDICT, "LIVE_NOT_CONFIGURED");
  });

  it("persisted store is not LIVE_NOT_CONFIGURED even without key in process", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T15:00:01.000Z",
    });
    const report = await runTask039({ storeRoot: root, livePull: false });
    assert.ok(report.QUOTE_OBSERVATIONS > 0);
    assert.notEqual(report.FINAL_VERDICT, "LIVE_NOT_CONFIGURED");
    assert.equal(report.COLLECTION_STATUS, "COLLECTING");
  });

  it("C D E F UTC commence last_update source vs collected", () => {
    assert.equal(hasUtcOffset("2026-10-03T16:00:00.000Z"), true);
    assert.equal(parseExactUtcMs("2026-10-03T16:00:00.000Z"), Date.parse("2026-10-03T16:00:00.000Z"));
    assert.equal(isDateOnly("2026-10-03"), true);
    assert.throws(() => requireExactUtc("2026-10-03", "kickoff"));
    const parsed = parseOddsApiPayload([
      {
        id: "x",
        sport_key: "soccer_epl",
        commence_time: "2026-10-03T16:00:00Z",
        home_team: "A",
        away_team: "B",
        bookmakers: [
          {
            key: "bet365",
            last_update: "2026-10-03T15:00:00Z",
            markets: [{ key: "h2h", last_update: "2026-10-03T15:00:00Z", outcomes: [{ name: "A", price: 2 }, { name: "Draw", price: 3.3 }, { name: "B", price: 3.8 }] }],
          },
        ],
      },
    ]);
    assert.equal(parsed.events[0]!.kickoff_at_utc, "2026-10-03T16:00:00Z");
    assert.equal(parsed.quotes[0]!.source_timestamp_utc, "2026-10-03T15:00:00Z");
    assert.equal(availableAt039("2026-10-03T15:00:00Z"), "2026-10-03T15:00:00Z");
    assert.equal(availableAt039(null), null);
    assert.equal(
      classifyQuote039({
        sourceQuoteTimestamp: "2026-10-03T15:00:01.000Z",
        commenceTime: "2026-10-03T16:00:00.000Z",
        collectedAt: "2026-10-03T15:00:01.000Z",
        market: "1X2",
        match: "MATCH_EXACT",
      }),
      "AMBIGUOUS",
    );
  });

  it("G H pre-kickoff vs post-kickoff", () => {
    assert.doesNotThrow(() => assertQuoteBeforeKickoff("2026-10-03T15:00:00.000Z", "2026-10-03T16:00:00.000Z"));
    assert.throws(() => assertQuoteBeforeKickoff("2026-10-03T16:00:01.000Z", "2026-10-03T16:00:00.000Z"));
    assert.equal(
      classifyQuote039({
        sourceQuoteTimestamp: "2026-10-03T16:00:01.000Z",
        commenceTime: "2026-10-03T16:00:00.000Z",
        collectedAt: "2026-10-03T16:00:02.000Z",
        market: "1X2",
        match: "MATCH_EXACT",
      }),
      "POSTMATCH",
    );
  });

  it("I J AS_OF no future leak and T-1h selection", () => {
    const cutoff = t1hCutoffMs039("2026-10-03T16:00:00.000Z")!;
    const hit = lastAtOrBeforeCutoff039(
      [
        { sourceMs: Date.parse("2026-10-03T14:00:00.000Z"), id: "early" },
        { sourceMs: Date.parse("2026-10-03T15:30:00.000Z"), id: "late" },
      ],
      cutoff,
    );
    assert.equal(hit?.id, "early");
    assert.equal(observationWindow039("2026-10-03T15:00:00.000Z", "2026-10-03T16:00:00.000Z"), "T-1h");
    const cov = binCoverage039([{ sourceQuoteUtc: "2026-10-01T16:00:00.000Z" }], "2026-10-03T16:00:00.000Z");
    assert.equal(cov["T-1h"], 0);
    assert.equal(cov["T-48h"], 1);
  });

  it("K L duplicate snapshot append-only", async () => {
    const store = loadStore039(tmpStore());
    const a = await collectOnce039({ store, adapters: [createFixtureAdapter(okPull())], nowUtc: "2026-10-03T15:00:01.000Z" });
    assert.equal(a.quotes, 3);
    const b = await collectOnce039({ store, adapters: [createFixtureAdapter(okPull())], nowUtc: "2026-10-03T15:00:01.000Z" });
    assert.equal(b.duplicates, 3);
    assert.equal(store.quotes.length, 3);
    const later = okPull({
      quotes: okPull().quotes.map((x) => ({ ...x, source_timestamp_utc: "2026-10-03T15:00:00.000Z", odds_decimal: 2.0 })),
    });
    await collectOnce039({ store, adapters: [createFixtureAdapter({ ...later, ...hashRawJson036(later.quotes) })], nowUtc: "2026-10-03T15:00:02.000Z" });
    assert.equal(store.quotes.length, 6);
    assert.ok(quoteKey039(store.quotes[0]!).includes("1.900000"));
  });

  it("M N O LOCK immutability REVEAL settlement isolation", async () => {
    const store = loadStore039(tmpStore());
    await collectOnce039({ store, adapters: [createFixtureAdapter(okPull())], nowUtc: "2026-10-03T15:00:01.000Z" });
    assert.equal(store.decisions.length, 1);
    assert.throws(() => mutateDecision(store.decisions[0]!, { overround: 9 }), ProspectiveIntegrityError);
    assert.throws(() => assertRevealAfterLock039(false), ExperimentIntegrityError);
    assert.doesNotThrow(() => assertRevealAfterLock039(true));
    applyScores039(
      store,
      [{ source_event_id: "e1", home_team: "Arsenal", away_team: "Chelsea", commence_time: "2026-10-03T16:00:00.000Z", completed: true, home_score: 2, away_score: 1 }],
      "2026-10-03T18:00:00.000Z",
      "the-odds-api-scores",
    );
    assert.equal(store.settlements[0]!.outcome, "HOME");
    assert.equal("outcome" in store.decisions[0]!, false);
    assert.equal(outcomeFromScores039(1, 1), "DRAW");
  });

  it("P Q missing kickoff and missing quote timestamp", async () => {
    const badKick = okPull({
      events: okPull().events.map((e) => ({ ...e, kickoff_at_utc: "not-a-time" })),
    });
    const s1 = loadStore039(tmpStore());
    const r1 = await collectOnce039({ store: s1, adapters: [createFixtureAdapter(badKick)], nowUtc: "2026-10-03T15:00:01.000Z" });
    assert.ok(r1.invalidKickoff >= 1);
    assert.equal(s1.events[0]!.kickoff_status, "INVALID_KICKOFF");
    const noTs = okPull({
      quotes: okPull().quotes.map((x) => ({ ...x, source_timestamp_utc: null })),
    });
    const s2 = loadStore039(tmpStore());
    await collectOnce039({ store: s2, adapters: [createFixtureAdapter(noTs)], nowUtc: "2026-10-03T15:00:01.000Z" });
    assert.ok(s2.quotes.every((q) => q.temporal_class === "INVALID"));
    assert.ok(s2.quotes.every((q) => q.available_at === null));
  });

  it("R S 401 and 429", async () => {
    const denied = createOddsApiAdapter({
      key: "test-key-not-secret",
      fetch: (async () => ({ status: 401, json: async () => ({}) })) as unknown as typeof fetch,
    });
    const bad = await denied.pull({ requestedAtUtc: "2026-10-03T14:00:00.000Z" });
    assert.equal(bad.status, "error");
    assert.equal(failureMode039(bad.error), "401");
    const limited = createOddsApiAdapter({
      key: "test-key-not-secret",
      fetch: (async () => ({ status: 429, json: async () => ({}) })) as unknown as typeof fetch,
    });
    const busy = await limited.pull({ requestedAtUtc: "2026-10-03T14:00:00.000Z" });
    assert.equal(busy.quotes.length, 0);
    assert.equal(failureMode039(busy.error), "429");
    const un = unavailablePull("the-odds-api", "2026-10-03T14:00:00.000Z", "THE_ODDS_API_KEY is not set");
    const s = loadStore039(tmpStore());
    await collectOnce039({ store: s, adapters: [createFixtureAdapter(un)] });
    assert.equal(s.quotes.length, 0);
    assert.equal(s.journal[0]!.failure_mode, "not_configured");
  });

  it("T deterministic fingerprint + frozen flags + scores parse + CLV", async () => {
    const cfg = loadExp039Config();
    assert.equal(cfg.open_task_040, false);
    assert.equal(cfg.historical_hunt, false);
    assert.equal(cfg.refit_market_devig, false);
    const batt = runHostileBattery039();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const root = tmpStore();
    await collectOnce039({ store: loadStore039(root), adapters: [createFixtureAdapter(okPull())], nowUtc: "2026-10-03T15:00:01.000Z" });
    const a = await runTask039({ storeRoot: root, adapters: [createFixtureAdapter(okPull())], livePull: false });
    const b = await runTask039({ storeRoot: root, adapters: [createFixtureAdapter(okPull())], livePull: false });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.BETS, 0);
    assert.equal(a.BANKROLL, "—");
    assert.equal(a.winner, null);
    assert.equal(a.open_task_040, false);
    assert.equal(auditTask039(a).ok, true, auditTask039(a).failures.join(","));
    assert.equal(
      fingerprint039({
        verdict: a.FINAL_VERDICT,
        exp: a.experiment_sha256,
        live: a.dataset_fingerprint,
        strict: a.STRICT_EVENTS,
        bets: 0,
        winner: null,
        configured: true,
      }),
      a.fingerprint,
    );
    const scores = parseOddsApiScores([
      {
        id: "e1",
        home_team: "Arsenal",
        away_team: "Chelsea",
        commence_time: "2026-10-03T16:00:00Z",
        completed: true,
        scores: [{ name: "Arsenal", score: "2" }, { name: "Chelsea", score: "0" }],
      },
    ]);
    assert.equal(scores[0]!.home_score, 2);
    assert.equal(matchGrade039({ home: "A", away: "B", commenceTime: "2026-10-03T16:00:00.000Z", sourceEventId: "x" }), "MATCH_EXACT");
    assert.equal(clv039({ entry: q(), later: [] }).status, "CLV_UNAVAILABLE");
    assert.equal(
      clv039({
        entry: q(),
        later: [q({ source_quote_timestamp: "2026-10-03T15:20:00.000Z", price: 1.8 })],
      }).status,
      "OK",
    );
  });
});
