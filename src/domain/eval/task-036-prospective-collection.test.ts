import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import type { AdapterPull036 } from "@/domain/eval/prospective-036/adapter";
import { auditTask036 } from "@/domain/eval/prospective-036/audit";
import { collectOnce036 } from "@/domain/eval/prospective-036/collector";
import { hasUtcOffset, isDateOnly, isNaiveDateTime, parseExactUtcMs, requireExactUtc } from "@/domain/eval/prospective-036/clocks";
import { loadExp036Config } from "@/domain/eval/prospective-036/config";
import { coverageAlias036, eventWindowFlags036 } from "@/domain/eval/prospective-036/health";
import {
  ProspectiveIntegrityError,
  assertMonotonicSource,
  assertNoFutureData,
  assertNotCloseAsDecision,
  assertNotFutureVsCollector,
  assertQuoteBeforeKickoff,
} from "@/domain/eval/prospective-036/integrity";
import { fingerprint036, runTask036 } from "@/domain/eval/prospective-036/lab";
import { runHostileBattery036 } from "@/domain/eval/prospective-036/leakage";
import { attachSettlement, buildDecisionContext, mutateDecision } from "@/domain/eval/prospective-036/lock";
import { createFixtureAdapter, createOddsApiAdapter, parseOddsApiPayload, unavailablePull } from "@/domain/eval/prospective-036/sources";
import { loadStore036, observationKey } from "@/domain/eval/prospective-036/store";
import { coverageFromSeconds, windowOf } from "@/domain/eval/prospective-036/windows";

function tmpStore(): string {
  return mkdtempSync(join(tmpdir(), "task036-"));
}

function okPull(over: Partial<AdapterPull036> = {}): AdapterPull036 {
  return {
    source: "the-odds-api",
    status: "ok",
    error: null,
    requested_at_utc: "2026-10-01T15:00:00.000Z",
    received_at_utc: "2026-10-01T15:00:01.000Z",
    provenance: "fixture",
    events: [
      {
        source_event_id: "e1",
        competition: "soccer_epl",
        season: "2026",
        home_team: "Arsenal",
        away_team: "Chelsea",
        kickoff_at_utc: "2026-10-01T16:00:00.000Z",
      },
    ],
    quotes: [
      {
        source_event_id: "e1",
        market: "1X2",
        selection: "HOME",
        odds_decimal: 1.9,
        bookmaker: "pinnacle",
        source_record_id: "e1|pinnacle|1X2|HOME",
        source_timestamp_utc: "2026-10-01T15:00:00.000Z",
      },
      {
        source_event_id: "e1",
        market: "1X2",
        selection: "DRAW",
        odds_decimal: 3.5,
        bookmaker: "pinnacle",
        source_record_id: "e1|pinnacle|1X2|DRAW",
        source_timestamp_utc: "2026-10-01T15:00:00.000Z",
      },
      {
        source_event_id: "e1",
        market: "1X2",
        selection: "AWAY",
        odds_decimal: 4.2,
        bookmaker: "pinnacle",
        source_record_id: "e1|pinnacle|1X2|AWAY",
        source_timestamp_utc: "2026-10-01T15:00:00.000Z",
      },
    ],
    ...over,
  };
}

describe("TASK 036 prospective collection", () => {
  it("clocks: timezone, date-only, naive, ordering, after kickoff", () => {
    assert.equal(hasUtcOffset("2026-10-01T15:00:00.000Z"), true);
    assert.equal(isDateOnly("2026-10-01"), true);
    assert.equal(isNaiveDateTime("2026-10-01 15:00:00"), true);
    assert.equal(parseExactUtcMs("2026-10-01T15:00:00.000Z"), Date.parse("2026-10-01T15:00:00.000Z"));
    assert.equal(parseExactUtcMs("2026-10-01 15:00:00"), null);
    assert.throws(() => requireExactUtc("2026-10-01", "k"), BlindLeakageError);
    assert.throws(() => requireExactUtc("2026-10-01 15:00:00", "q"), BlindLeakageError);
    assert.doesNotThrow(() => assertQuoteBeforeKickoff("2026-10-01T15:00:00.000Z", "2026-10-01T16:00:00.000Z"));
    assert.throws(() => assertQuoteBeforeKickoff("2026-10-01T16:00:00.000Z", "2026-10-01T16:00:00.000Z"), ProspectiveIntegrityError);
    assert.throws(() => assertNoFutureData("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z"), BlindLeakageError);
    assert.equal(windowOf(3600), "T-1h");
    assert.equal(windowOf(90), "T-5m");
    assert.equal(windowOf(-1), null);
  });

  it("idempotent collect, STRICT T-1h lock, snapshot hash, restart", async () => {
    const root = tmpStore();
    const adapter = createFixtureAdapter(okPull());
    const store = loadStore036(root);
    const a = await collectOnce036({ store, adapters: [adapter] });
    assert.equal(a.events, 1);
    assert.equal(a.quotes, 3);
    assert.equal(a.strictQuotes, 3);
    assert.equal(a.locked, 1);
    assert.equal(store.quotes[0]!.temporal_basis, "SOURCE_TIMESTAMP");
    assert.equal(store.quotes[0]!.window, "T-1h");
    const hash1 = store.snapshots[0]!.quotes_hash;
    const store2 = loadStore036(root);
    const b = await collectOnce036({ store: store2, adapters: [adapter] });
    assert.equal(b.duplicates, 3);
    assert.equal(store2.quotes.length, 3);
    assert.equal(store2.decisions.length, 1);
    assert.equal(store2.snapshots[0]!.quotes_hash, hash1);
    assert.equal(
      observationKey({
        source: "the-odds-api",
        source_record_id: "e1|pinnacle|1X2|HOME",
        source_timestamp: "2026-10-01T15:00:00.000Z",
        market: "1X2",
        selection: "HOME",
        price: 1.9,
      }).includes("1.900000"),
      true,
    );
  });

  it("rejects post-kickoff, naive, date-only, outage, unavailable", async () => {
    const late = okPull({
      quotes: okPull().quotes.map((q) => ({ ...q, source_timestamp_utc: "2026-10-01T17:00:00.000Z" })),
    });
    const s1 = loadStore036(tmpStore());
    await collectOnce036({ store: s1, adapters: [createFixtureAdapter(late)] });
    assert.ok(s1.quotes.every((q) => q.availability_class === "POSTMATCH"));
    assert.equal(s1.decisions.length, 0);

    const naive = okPull({
      quotes: okPull().quotes.map((q) => ({ ...q, source_timestamp_utc: "2026-10-01 15:00:00" })),
    });
    const s2 = loadStore036(tmpStore());
    await collectOnce036({ store: s2, adapters: [createFixtureAdapter(naive)] });
    assert.ok(s2.quotes.every((q) => q.availability_class === "STRICT" || q.availability_class === "AMBIGUOUS"));
    assert.ok(s2.quotes.every((q) => q.temporal_basis === "COLLECTOR_TIMESTAMP"));

    const outage: AdapterPull036 = {
      source: "the-odds-api",
      status: "error",
      error: "HTTP 503",
      requested_at_utc: "2026-10-01T14:00:00.000Z",
      received_at_utc: "2026-10-01T14:00:02.000Z",
      events: [],
      quotes: [],
      provenance: "outage",
    };
    const s3 = loadStore036(tmpStore());
    const r3 = await collectOnce036({ store: s3, adapters: [createFixtureAdapter(outage)] });
    assert.equal(r3.quotes, 0);
    assert.equal(s3.journal[0]!.status, "error");

    const s4 = loadStore036(tmpStore());
    const un = unavailablePull("the-odds-api", "2026-10-01T14:00:00.000Z", "no key");
    await collectOnce036({ store: s4, adapters: [createFixtureAdapter(un)] });
    assert.equal(s4.quotes.length, 0);
    assert.equal(s4.journal[0]!.status, "SOURCE_UNAVAILABLE");
  });

  it("lock immutability, settlement separation, provenance parse", () => {
    const dec = buildDecisionContext({
      decisionId: "d1",
      eventId: "e1",
      decisionTimestampUtc: "2026-10-01T15:00:00.000Z",
      bookmaker: "pinnacle",
      quotes: okPull().quotes.map((q) => ({
        event_id: "e1",
        source_event_id: q.source_event_id,
        competition: "soccer_epl",
        season: "2026",
        home_team: "Arsenal",
        away_team: "Chelsea",
        kickoff_at_utc: "2026-10-01T16:00:00.000Z",
        market: q.market,
        selection: q.selection,
        odds_decimal: q.odds_decimal,
        quote_observed_at_utc: q.source_timestamp_utc!,
        source_timestamp_utc: q.source_timestamp_utc,
        collector_timestamp_utc: "2026-10-01T15:00:01.000Z",
        requested_at_utc: "2026-10-01T14:00:00.000Z",
        received_at_utc: "2026-10-01T15:00:01.000Z",
        source: "the-odds-api",
        bookmaker: q.bookmaker,
        source_record_id: q.source_record_id,
        observation_id: q.source_record_id,
        ingested_at_utc: "2026-10-01T15:00:01.000Z",
        temporal_basis: "SOURCE_TIMESTAMP",
        availability_class: "STRICT",
        decision_id: null,
        snapshot_id: "s",
        data_fingerprint: "f",
        window: "T-1h",
        seconds_to_kickoff: 3600,
      })),
    });
    assert.equal(dec.state, "LOCKED");
    assert.ok(dec.home_devig + dec.draw_devig + dec.away_devig > 0.999);
    assert.throws(() => mutateDecision(dec, { overround: 9 }), ProspectiveIntegrityError);
    assert.throws(() => attachSettlement({ ...dec, state: "PRELOCK" }), ProspectiveIntegrityError);
    assert.doesNotThrow(() => attachSettlement(dec));

    const parsed = parseOddsApiPayload([
      {
        id: "x",
        sport_key: "soccer_epl",
        commence_time: "2026-10-01T16:00:00Z",
        home_team: "A",
        away_team: "B",
        bookmakers: [
          {
            key: "bet365",
            last_update: "2026-10-01T15:00:00Z",
            markets: [{ key: "h2h", last_update: "2026-10-01T15:00:00Z", outcomes: [{ name: "A", price: 2.0 }, { name: "Draw", price: 3.3 }, { name: "B", price: 3.8 }] }],
          },
        ],
      },
    ]);
    assert.equal(parsed.events.length, 1);
    assert.equal(parsed.quotes.length, 3);
    assert.equal(parsed.quotes[0]!.source_timestamp_utc, "2026-10-01T15:00:00Z");
  });

  it("hostile battery + lab dual-run + frozen flags + no silent bankroll", async () => {
    const cfg = loadExp036Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.open_task_037_historical, false);
    assert.equal(cfg.use_historical_hunt, false);
    const batt = runHostileBattery036();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const root = tmpStore();
    await collectOnce036({ store: loadStore036(root), adapters: [createFixtureAdapter(okPull())] });
    const a = await runTask036({ storeRoot: root, adapters: [createFixtureAdapter(okPull())], livePull: false });
    const b = await runTask036({ storeRoot: root, adapters: [createFixtureAdapter(okPull())], livePull: false });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.COLLECTION_STATUS, "READY");
    assert.equal(a.STRICT_EVENTS, 1);
    assert.equal(a.BETS, 0);
    assert.equal(a.BANKROLL, "—");
    assert.equal(a.MODEL_READY, false);
    assert.equal(a.EDGE, false);
    assert.equal(a.winner, null);
    assert.equal(auditTask036(a).ok, true, auditTask036(a).failures.join(","));
    assert.equal(
      fingerprint036({
        verdict: a.verdict,
        exp: a.experiment_sha256,
        dataset: a.dataset_fingerprint,
        strictEvents: a.STRICT_EVENTS,
        bets: 0,
        winner: null,
        oddsKey: Boolean(process.env.THE_ODDS_API_KEY),
        fdTok: Boolean(process.env.FOOTBALL_DATA_ORG_TOKEN),
      }),
      a.fingerprint,
    );

    const blocked = await runTask036({
      storeRoot: tmpStore(),
      adapters: [createFixtureAdapter(unavailablePull("the-odds-api", "2026-10-01T14:00:00.000Z", "no key"))],
      livePull: false,
    });
    assert.equal(blocked.COLLECTION_STATUS, "BLOCKED");
    assert.ok(blocked.blocker);
  });

  it("clock drift, monotonic, close-as-decision, coverage without interpolation", () => {
    assert.throws(() => assertNotFutureVsCollector("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z", 60_000), ProspectiveIntegrityError);
    assert.doesNotThrow(() => assertNotFutureVsCollector("2026-10-01T15:00:30.000Z", "2026-10-01T15:00:00.000Z", 60_000));
    assert.throws(() => assertMonotonicSource("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z"), ProspectiveIntegrityError);
    assert.throws(() => assertNotCloseAsDecision(true), ProspectiveIntegrityError);
    const cov = coverageFromSeconds([3600]);
    assert.equal(cov["T-1h"], 1);
    assert.equal(cov["T-72h"], 0);
    assert.equal(cov["T-5m"], 0);
  });

  it("snapshot_id assigned, decision hash stable, event coverage flags, provenance", async () => {
    const store = loadStore036(tmpStore());
    const adapter = createFixtureAdapter(okPull());
    await collectOnce036({ store, adapters: [adapter] });
    assert.ok(store.quotes.every((q) => q.snapshot_id.length > 0));
    assert.ok(store.quotes.every((q) => q.decision_id != null));
    assert.equal(store.snapshots[0]!.quotes_hash.length > 10, true);
    const dec = store.decisions[0]!;
    const rebuilt = buildDecisionContext({
      decisionId: dec.decision_id,
      eventId: dec.event_id,
      decisionTimestampUtc: dec.decision_timestamp_utc,
      bookmaker: dec.bookmaker,
      quotes: store.quotes,
    });
    assert.equal(rebuilt.decision_context_hash, dec.decision_context_hash);
    const flags = coverageAlias036(eventWindowFlags036(store.quotes, store.events[0]!.event_id));
    assert.equal(flags.coverage_1h, 1);
    assert.equal(flags.coverage_72h, 0);
    assert.equal(adapter.getProvenance(), "fixture");
    assert.equal(adapter.getTimestamp(okPull().quotes[0]!), "2026-10-01T15:00:00.000Z");
    assert.equal(adapter.getKickoff(okPull().events[0]!), "2026-10-01T16:00:00.000Z");
    assert.equal((await adapter.getEvent("e1"))?.home_team, "Arsenal");
    assert.deepEqual(await adapter.getMarkets("e1"), ["1X2"]);
  });

  it("retry does not invent source timestamps; outage writes no quotes", async () => {
    let calls = 0;
    const body = [
      {
        id: "live1",
        sport_key: "soccer_epl",
        commence_time: "2026-10-01T16:00:00Z",
        home_team: "A",
        away_team: "B",
        bookmakers: [
          {
            key: "pinnacle",
            last_update: "2026-10-01T15:00:00Z",
            markets: [{ key: "h2h", last_update: "2026-10-01T15:00:00Z", outcomes: [{ name: "A", price: 2.1 }, { name: "Draw", price: 3.4 }, { name: "B", price: 3.6 }] }],
          },
        ],
      },
    ];
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return { status: 503, json: async () => ({}) };
      return { status: 200, json: async () => body };
    }) as unknown as typeof fetch;
    const adapter = createOddsApiAdapter({ fetch: fetchImpl, key: "test-key-not-secret" });
    const requested = "2026-10-01T14:00:00.000Z";
    const pull = await adapter.pull({ requestedAtUtc: requested });
    assert.equal(pull.status, "ok");
    assert.equal(pull.requested_at_utc, requested);
    assert.ok(pull.received_at_utc);
    assert.equal(pull.quotes[0]!.source_timestamp_utc, "2026-10-01T15:00:00Z");
    assert.ok(calls >= 2);

    const failFetch = (async () => ({ status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    const denied = createOddsApiAdapter({ fetch: failFetch, key: "test-key-not-secret" });
    const bad = await denied.pull({ requestedAtUtc: requested });
    assert.equal(bad.status, "error");
    assert.equal(bad.quotes.length, 0);
  });
});
