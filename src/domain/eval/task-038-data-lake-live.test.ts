import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { AdapterPull036 } from "@/domain/eval/prospective-036/adapter";
import { hasUtcOffset, isDateOnly, isNaiveDateTime, parseExactUtcMs, requireExactUtc } from "@/domain/eval/prospective-036/clocks";
import { assertQuoteBeforeKickoff } from "@/domain/eval/prospective-036/integrity";
import { attachSettlement, buildDecisionContext, mutateDecision } from "@/domain/eval/prospective-036/lock";
import { createFixtureAdapter, createOddsApiAdapter, hashRawJson036, parseOddsApiPayload, unavailablePull } from "@/domain/eval/prospective-036/sources";
import { ProspectiveIntegrityError } from "@/domain/eval/prospective-036/integrity";
import { observationKey } from "@/domain/eval/prospective-036/store";
import { auditTask038 } from "@/domain/eval/datalake-038/audit";
import { asOfUtcMs038, coverageFromObservations038, lastObservationAtOrBeforeAsOf, lastObservationAtOrBeforeT1h038 } from "@/domain/eval/datalake-038/asof";
import { canEnterStrict038, classifyTemporal038, quoteBeforeKickoff038 } from "@/domain/eval/datalake-038/classify";
import { collectOnce038, loadStore038, persistRaw038 } from "@/domain/eval/datalake-038/collector";
import { loadExp038Config } from "@/domain/eval/datalake-038/config";
import { collectionStatus038, complete1x2Events038, matchExactCount038, strictQuotes038 } from "@/domain/eval/datalake-038/health";
import { assertCapitalIsolation038, assertDecisionHasNoOutcome038, assertNotFixtureInProduction038 } from "@/domain/eval/datalake-038/isolation";
import { fingerprint038, runTask038 } from "@/domain/eval/datalake-038/lab";
import { buildLake038 } from "@/domain/eval/datalake-038/lake";
import { runHostileBattery038 } from "@/domain/eval/datalake-038/leakage";
import { canonicalEventKey038, matchGrade038, normalizeTeam038 } from "@/domain/eval/datalake-038/matching";
import { createMultiSportOddsAdapter038 } from "@/domain/eval/datalake-038/sources";

function tmpStore(): string {
  return mkdtempSync(join(tmpdir(), "task038-"));
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
      source_timestamp_utc: "2026-10-01T16:00:00.000Z",
    },
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "DRAW",
      odds_decimal: 3.5,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|DRAW",
      source_timestamp_utc: "2026-10-01T16:00:00.000Z",
    },
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "AWAY",
      odds_decimal: 4.2,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|AWAY",
      source_timestamp_utc: "2026-10-01T16:00:00.000Z",
    },
  ];
  const raw = hashRawJson036({ events, quotes });
  return {
    source: "the-odds-api",
    status: "ok",
    error: null,
    requested_at_utc: "2026-10-01T16:00:00.000Z",
    received_at_utc: "2026-10-01T16:00:01.000Z",
    provenance: "the-odds-api live",
    events,
    quotes,
    ...raw,
    ...over,
  };
}

describe("TASK 038 data lake + live STRICT", () => {
  it("1 utc conversion: keep source ISO, reject naive and date-only", () => {
    const iso = "2026-10-01T15:00:00.000Z";
    assert.equal(hasUtcOffset(iso), true);
    assert.equal(parseExactUtcMs(iso), Date.parse(iso));
    assert.equal(isDateOnly("2026-10-01"), true);
    assert.equal(isNaiveDateTime("2026-10-01 15:00:00"), true);
    assert.throws(() => requireExactUtc("2026-10-01", "kickoff"));
    assert.throws(() => requireExactUtc("2026-10-01 15:00:00", "quote"));
    assert.equal(classifyTemporal038({
      quoteTimestampUtc: "2026-10-01T15:00:00",
      kickoffUtc: iso,
      temporalBasis: "SOURCE_TIMESTAMP",
      clientRetrievedAt: null,
      match: "MATCH_EXACT",
      market: "1X2",
      provenance: "the-odds-api",
    }), "AMBIGUOUS");
  });

  it("2-3 quote before kickoff accepted; quote after rejected", () => {
    assert.equal(quoteBeforeKickoff038("2026-10-01T15:00:00.000Z", "2026-10-01T16:00:00.000Z"), true);
    assert.doesNotThrow(() => assertQuoteBeforeKickoff("2026-10-01T15:00:00.000Z", "2026-10-01T16:00:00.000Z"));
    assert.throws(() => assertQuoteBeforeKickoff("2026-10-01T16:00:01.000Z", "2026-10-01T16:00:00.000Z"), ProspectiveIntegrityError);
    assert.equal(
      canEnterStrict038({
        quoteTimestampUtc: "2026-10-01T16:00:00.000Z",
        kickoffUtc: "2026-10-01T16:00:00.000Z",
        temporalBasis: "SOURCE_TIMESTAMP",
        clientRetrievedAt: null,
        match: "MATCH_EXACT",
        market: "1X2",
        provenance: "the-odds-api",
      }),
      false,
    );
  });

  it("4-6 AS_OF T-1h, T-24h, sparse observations, no interpolation", () => {
    const kick = "2026-10-03T16:00:00.000Z";
    const early = { observedAtMs: Date.parse("2026-10-01T16:00:00.000Z"), bookmaker: "pinnacle", market: "1X2", selection: "HOME" };
    const mid = { observedAtMs: Date.parse("2026-10-02T12:00:00.000Z"), bookmaker: "pinnacle", market: "1X2", selection: "HOME" };
    const cov = coverageFromObservations038([early], kick);
    assert.equal(cov["T-24h"], 1);
    assert.equal(cov["T-1h"], 1);
    assert.equal(cov["T-5m"], 1);
    const t1hAsOf = asOfUtcMs038(kick, "T-1h")!;
    const chosen = lastObservationAtOrBeforeAsOf([early, mid], t1hAsOf);
    assert.equal(chosen?.observedAtMs, mid.observedAtMs);
    const sparse = coverageFromObservations038([], kick);
    assert.equal(sparse["T-1h"], 0);
    const t1 = lastObservationAtOrBeforeT1h038([
      { observedAtMs: early.observedAtMs, kickoffMs: Date.parse(kick) },
      { observedAtMs: Date.parse("2026-10-03T15:30:00.000Z"), kickoffMs: Date.parse(kick) },
    ]);
    assert.equal(t1?.observedAtMs, early.observedAtMs);
  });

  it("7-8 duplicate observations keep distinct timestamps; bookmakers stay separate", async () => {
    const root = tmpStore();
    const store = loadStore038(root);
    const a = await collectOnce038({ store, adapters: [createFixtureAdapter(okPull())] });
    assert.equal(a.quotes, 3);
    const b = await collectOnce038({ store, adapters: [createFixtureAdapter(okPull())] });
    assert.equal(b.duplicates, 3);
    assert.equal(store.quotes.length, 3);
    const later = okPull({
      quotes: okPull().quotes.map((q) => ({ ...q, source_timestamp_utc: "2026-10-02T12:00:00.000Z" })),
    });
    const laterRaw = hashRawJson036(later.quotes);
    await collectOnce038({ store, adapters: [createFixtureAdapter({ ...later, ...laterRaw })] });
    assert.equal(store.quotes.length, 6);
    const twoBooks = okPull({
      quotes: [
        ...okPull().quotes,
        ...okPull().quotes.map((q) => ({ ...q, bookmaker: "bet365", source_record_id: q.source_record_id.replace("pinnacle", "bet365") })),
      ],
    });
    const s2 = loadStore038(tmpStore());
    await collectOnce038({ store: s2, adapters: [createFixtureAdapter({ ...twoBooks, ...hashRawJson036(twoBooks.quotes) })] });
    assert.deepEqual([...new Set(s2.quotes.map((q) => q.bookmaker))].sort(), ["bet365", "pinnacle"]);
    assert.ok(
      observationKey({
        source: "the-odds-api",
        source_record_id: "e1|pinnacle|1X2|HOME",
        source_timestamp: "2026-10-01T16:00:00.000Z",
        market: "1X2",
        selection: "HOME",
        price: 1.9,
      }).includes("2026-10-01T16:00:00.000Z"),
    );
  });

  it("9 event matching MATCH_EXACT vs ambiguous", () => {
    assert.equal(normalizeTeam038("Arsenal FC"), "arsenal");
    assert.equal(
      matchGrade038({
        home: "Arsenal",
        away: "Chelsea",
        kickoffUtc: "2026-10-03T16:00:00.000Z",
        competition: "soccer_epl",
        sourceEventId: "e1",
      }),
      "MATCH_EXACT",
    );
    assert.equal(matchGrade038({ home: "A", away: "B", kickoffUtc: null }), "MATCH_FAILED");
    assert.ok(canonicalEventKey038({ competition: "EPL", season: "2026", kickoffUtc: "t", home: "Arsenal FC", away: "Chelsea" }).includes("arsenal"));
  });

  it("10-11 LOCK immutability and FT leakage", () => {
    const dec = buildDecisionContext({
      decisionId: "d1",
      eventId: "e1",
      decisionTimestampUtc: "2026-10-01T16:00:00.000Z",
      bookmaker: "pinnacle",
      quotes: okPull().quotes.map((q) => ({
        event_id: "e1",
        source_event_id: q.source_event_id,
        competition: "soccer_epl",
        season: "2026",
        home_team: "Arsenal",
        away_team: "Chelsea",
        kickoff_at_utc: "2026-10-03T16:00:00.000Z",
        market: q.market,
        selection: q.selection,
        odds_decimal: q.odds_decimal,
        quote_observed_at_utc: q.source_timestamp_utc!,
        source_timestamp_utc: q.source_timestamp_utc,
        collector_timestamp_utc: "2026-10-01T16:00:01.000Z",
        requested_at_utc: "2026-10-01T16:00:00.000Z",
        received_at_utc: "2026-10-01T16:00:01.000Z",
        source: "the-odds-api",
        bookmaker: q.bookmaker,
        source_record_id: q.source_record_id,
        observation_id: q.source_record_id,
        ingested_at_utc: "2026-10-01T16:00:01.000Z",
        temporal_basis: "SOURCE_TIMESTAMP",
        availability_class: "STRICT",
        decision_id: null,
        snapshot_id: "s",
        data_fingerprint: "f",
        window: "T-72h",
        seconds_to_kickoff: 172800,
      })),
    });
    assert.equal(dec.state, "LOCKED");
    assert.throws(() => mutateDecision(dec, { overround: 9 }), ProspectiveIntegrityError);
    assert.throws(() => attachSettlement({ ...dec, state: "PRELOCK" }), ProspectiveIntegrityError);
    assert.throws(() => assertDecisionHasNoOutcome038({ ...dec, outcome: "HOME" }), ExperimentIntegrityError);
    assert.doesNotThrow(() => assertDecisionHasNoOutcome038(dec));
  });

  it("12 research/capital isolation", () => {
    assert.throws(
      () => assertCapitalIsolation038({ partition: "CAPITAL_STRICT", temporalClass: "DATE_ONLY", source: "anishkhetani" }),
      ExperimentIntegrityError,
    );
    assert.doesNotThrow(() =>
      assertCapitalIsolation038({ partition: "CAPITAL_STRICT", temporalClass: "LEVEL_A_STRICT", source: "the-odds-api" }),
    );
    assert.throws(
      () => assertNotFixtureInProduction038({ production: true, provenance: "fixture", source: "the-odds-api" }),
      ExperimentIntegrityError,
    );
  });

  it("13 raw hash reproducibility", () => {
    const root = tmpStore();
    const payload = { id: "x", commence_time: "2026-10-01T16:00:00Z" };
    const a = persistRaw038(root, "the-odds-api", payload);
    const b = persistRaw038(root, "the-odds-api", payload);
    assert.equal(a.sha256, b.sha256);
    assert.equal(a.sha256, createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
    assert.equal(hashRawJson036(payload).raw_hash, a.sha256);
  });

  it("14-16 API unavailable, key missing, live parse", async () => {
    assert.equal(collectionStatus038({ configured: false, lastStatus: null, lastOk: false, lastError: null }), "NOT_CONFIGURED");
    const s = loadStore038(tmpStore());
    await collectOnce038({
      store: s,
      adapters: [createFixtureAdapter(unavailablePull("the-odds-api", "2026-10-01T14:00:00.000Z", "no key"))],
    });
    assert.equal(s.quotes.length, 0);
    const denied = createOddsApiAdapter({
      key: "test-key-not-secret",
      fetch: (async () => ({ status: 401, json: async () => ({}) })) as unknown as typeof fetch,
    });
    const bad = await denied.pull({ requestedAtUtc: "2026-10-01T14:00:00.000Z" });
    assert.equal(bad.status, "error");
    assert.equal(bad.quotes.length, 0);
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
            markets: [{ key: "h2h", last_update: "2026-10-01T15:00:00Z", outcomes: [{ name: "A", price: 2 }, { name: "Draw", price: 3.3 }, { name: "B", price: 3.8 }] }],
          },
        ],
      },
    ]);
    assert.equal(parsed.quotes[0]!.source_timestamp_utc, "2026-10-01T15:00:00Z");
    const missing = createMultiSportOddsAdapter038({ key: "" });
    assert.equal(missing.configured(), false);
    const none = await missing.pull({ requestedAtUtc: "2026-10-01T14:00:00.000Z" });
    assert.equal(none.status, "SOURCE_UNAVAILABLE");
  });

  it("17-19 malformed timestamp, timezone missing, kickoff missing", () => {
    assert.equal(
      classifyTemporal038({
        quoteTimestampUtc: "not-a-date",
        kickoffUtc: "2026-10-01T16:00:00.000Z",
        temporalBasis: "SOURCE_TIMESTAMP",
        clientRetrievedAt: null,
        match: "MATCH_EXACT",
        market: "1X2",
        provenance: "the-odds-api",
      }),
      "AMBIGUOUS",
    );
    assert.equal(
      canEnterStrict038({
        quoteTimestampUtc: "2026-10-01T15:00:00.000Z",
        kickoffUtc: null,
        temporalBasis: "SOURCE_TIMESTAMP",
        clientRetrievedAt: null,
        match: "MATCH_EXACT",
        market: "1X2",
        provenance: "the-odds-api",
      }),
      false,
    );
    assert.equal(
      classifyTemporal038({
        quoteTimestampUtc: "2026-10-01T15:00:00.000Z",
        kickoffUtc: "2026-10-01T16:00:00.000Z",
        temporalBasis: "COLLECTOR_TIMESTAMP",
        clientRetrievedAt: "2026-10-01T15:00:00.000Z",
        match: "MATCH_EXACT",
        market: "1X2",
        provenance: "the-odds-api",
      }),
      "AMBIGUOUS",
    );
  });

  it("20 collector restart/idempotency + lake + lab dual-run", async () => {
    const cfg = loadExp038Config();
    assert.equal(cfg.open_task_039, false);
    assert.equal(cfg.historical_hunt, false);
    assert.equal(cfg.count_legacy_031_as_new_strict, false);
    const batt = runHostileBattery038();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const lake = buildLake038();
    assert.ok(lake.sources.length >= 18);
    assert.equal(lake.sources.find((s) => s.sourceId === "anishkhetani")?.strictEligible, false);
    assert.equal(lake.sources.find((s) => s.sourceId === "task-031-base")?.partition, "REFERENCE");
    assert.ok(lake.researchEvents > 0);
    const root = tmpStore();
    const adapter = createFixtureAdapter(okPull());
    await collectOnce038({ store: loadStore038(root), adapters: [adapter] });
    const a = await runTask038({ storeRoot: root, adapters: [adapter], livePull: false, persistLake: false });
    const b = await runTask038({ storeRoot: root, adapters: [adapter], livePull: false, persistLake: false });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.STRICT_EVENTS, 1);
    assert.equal(a.MATCH_EXACT, 1);
    assert.equal(complete1x2Events038(loadStore038(root)), 1);
    assert.equal(matchExactCount038(loadStore038(root)), 1);
    assert.equal(strictQuotes038(loadStore038(root)).length, 3);
    assert.equal(a.BETS, 0);
    assert.equal(a.BANKROLL, "—");
    assert.equal(a.MODEL_READY, false);
    assert.equal(a.winner, null);
    assert.equal(a.open_task_039, false);
    assert.equal(auditTask038(a).ok, true, auditTask038(a).failures.join(","));
    const blocked = await runTask038({
      storeRoot: tmpStore(),
      adapters: [createFixtureAdapter(unavailablePull("the-odds-api", "2026-10-01T14:00:00.000Z", "no key"))],
      livePull: false,
      persistLake: false,
    });
    assert.equal(blocked.FINAL_VERDICT, "LIVE_NOT_CONFIGURED");
    assert.equal(blocked.COLLECTION_STATUS, "NOT_CONFIGURED");
    assert.equal(
      fingerprint038({
        verdict: a.FINAL_VERDICT,
        exp: a.experiment_sha256,
        lake: a.lake.fingerprint,
        live: a.dataset_fingerprint,
        strictEvents: a.STRICT_EVENTS,
        bets: 0,
        winner: null,
        apiKey: a.API_KEY,
      }),
      a.fingerprint,
    );
  });
});
