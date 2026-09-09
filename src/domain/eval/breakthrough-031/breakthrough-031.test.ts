import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { auditTask031 } from "@/domain/eval/breakthrough-031/audit";
import { inspectFiveDollarCsv, inspectJulienOddsCsv, classifyTemporal } from "@/domain/eval/breakthrough-031/classify";
import { loadExp031Config } from "@/domain/eval/breakthrough-031/config";
import {
  acceptQuoteAtAsOf,
  dedupeQuotesDeterministic,
  leakAutoPromote031,
  leakHoldoutModelSelection,
  leakMasanielloProduction,
  leakSilentThousand,
  rejectAmbiguousMatch,
  rejectCloseAfterAsOf,
  rejectDateOnlyFromStrict,
  rejectFutureQuote,
  rejectKickoffTimezoneMismatch,
  rejectNaiveAsUtc,
  rejectOutcomeBeforeReveal,
  rejectQuoteAfterAsOf,
  runHostileBattery031,
} from "@/domain/eval/breakthrough-031/leakage";
import { annualFromEvents, fingerprint031, runTask031, verdict031 } from "@/domain/eval/breakthrough-031/lab";
import type { CanonicalQuote031 } from "@/domain/eval/breakthrough-031/types";

function q(partial: Partial<CanonicalQuote031>): CanonicalQuote031 {
  return {
    event_id: "e1",
    competition: "x",
    season: "2015",
    home_team: "A",
    away_team: "B",
    kickoff: "2015-09-25T15:30:00.000Z",
    market: "1X2",
    selection: "HOME",
    odds: 2.1,
    quote_timestamp: "2015-09-25T14:30:00.000Z",
    timestamp_timezone: "UTC",
    available_at: "2015-09-25T14:30:00.000Z",
    source: "base",
    source_dataset: "DATASET_031_BASE",
    bookmaker: "bet365",
    temporal_basis: "EXACT_RELATIVE",
    license: "gpl",
    match_confidence: "MATCH_EXACT",
    strict_status: "STRICT",
    ...partial,
  };
}

describe("TASK 031 final data breakthrough", () => {
  it("1-8 temporal firewall", () => {
    const asOf = Date.parse("2016-06-01T12:00:00.000Z");
    assert.throws(() => rejectFutureQuote(asOf + 1, asOf), BlindLeakageError);
    assert.equal(acceptQuoteAtAsOf(asOf, asOf), true);
    assert.throws(() => rejectQuoteAfterAsOf(asOf + 1, asOf), BlindLeakageError);
    assert.throws(
      () => rejectKickoffTimezoneMismatch("2016-06-01T13:00:00", "2016-06-01T12:00:00Z"),
      BlindLeakageError,
    );
    assert.throws(() => rejectDateOnlyFromStrict("2020-03-07", true), BlindLeakageError);
    assert.doesNotThrow(() => rejectDateOnlyFromStrict("2020-03-07T12:00:00.000Z", true));
    assert.throws(() => rejectAmbiguousMatch("MATCH_AMBIGUOUS"), BlindLeakageError);
    assert.throws(() => rejectCloseAfterAsOf(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => rejectOutcomeBeforeReveal({ outcome: "HOME" }), BlindLeakageError);
    assert.throws(() => rejectNaiveAsUtc("2024-07-26 00:30:00"), BlindLeakageError);
    assert.throws(() => assertLockedBeforeReveal(false), BlindLeakageError);
  });

  it("9 duplicate quotes deterministic", () => {
    const a = q({ source: "b" });
    const b = q({ source: "a" });
    const d1 = dedupeQuotesDeterministic([a, b, a]);
    const d2 = dedupeQuotesDeterministic([b, a, b]);
    assert.equal(d1.length, 1);
    assert.equal(d2.length, 1);
    assert.deepEqual(d1, d2);
  });

  it("5 DATE_ONLY and opening labels never STRICT", () => {
    const dateOnly = classifyTemporal({
      kickoff: "2020-03-07",
      quoteTimestamp: "2020-03-07",
      timestampType: "DATE_ONLY",
      timezoneDocumented: false,
    });
    assert.equal(dateOnly.strictOk, false);
    const open = classifyTemporal({
      kickoff: "2025-08-15T19:00:00+00:00",
      quoteTimestamp: null,
      timestampType: "OPEN_CLOSE_LABEL",
      timezoneDocumented: true,
    });
    assert.equal(open.strictOk, false);
    const five = inspectFiveDollarCsv(
      "fixture_id,kickoff_utc,opening_1x2_home,opening_1x2_draw,opening_1x2_away,closing_1x2_home,closing_1x2_draw,closing_1x2_away\n1,2025-08-15T19:00:00+00:00,1.3,5,8,1.2,6,9\n",
    );
    assert.equal(five.strict_events, 0);
    const julien = inspectJulienOddsCsv(
      "match_id,commence_time,bookmaker_last_update,datetime_insert\nab,2024-07-26 00:30:00,2024-07-25 10:50:04,2024-09-24 09:17:32\n",
    );
    assert.equal(julien.strict_events, 0);
    assert.equal(julien.naive_timestamps, true);
  });

  it("10-14 fingerprint, annual 1000, no-data End=—, no-edge zero bets", async () => {
    const a = await runTask031({ skipHeavy: true });
    const b = await runTask031({ skipHeavy: true });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(
      fingerprint031({
        verdict: a.verdict,
        baseSha: a.observed_base_sha256,
        unionSha: a.union_fingerprint,
        strict: a.strict_events,
        added: a.added_strict_events,
        predictiveGate: a.predictive_gate,
      }),
      a.fingerprint,
    );
    for (const row of a.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
      if (row.status === "INSUFFICIENT_DATA" || row.status === "NO_EDGE" || row.status === "PARTIAL_DATA") {
        assert.equal(row.bets, 0);
      }
    }
    const emptyYear = a.annual.find((r) => r.year === 2001);
    assert.ok(emptyYear);
    assert.equal(emptyYear!.end, null);
    assert.equal(emptyYear!.status, "INSUFFICIENT_DATA");
    assert.throws(() => leakSilentThousand(1000, 0), BlindLeakageError);
    const gated = annualFromEvents({
      years: [2015],
      events: [
        {
          event_id: "e",
          competition: "x",
          season: "2015",
          home_team: "A",
          away_team: "B",
          kickoff: "2015-09-25T15:30:00.000Z",
          market: "1X2",
          home_odds: 2,
          draw_odds: 3,
          away_odds: 4,
          quote_timestamp: "2015-09-25T14:30:00.000Z",
          timestamp_timezone: "UTC",
          available_at: "2015-09-25T14:30:00.000Z",
          source: "base",
          source_dataset: "DATASET_031_BASE",
          bookmaker: "bet365",
          temporal_basis: "EXACT_RELATIVE",
          license: "gpl",
          match_confidence: "MATCH_EXACT",
          strict_status: "STRICT",
          ft_home: 1,
          ft_away: 0,
        },
      ],
      periodStart: "2015-09-01T00:00:00.000Z",
      periodEnd: "2016-11-19T00:00:00.000Z",
      predictiveGate: false,
      fixture: false,
    });
    assert.equal(gated[0]!.bets, 0);
    assert.equal(gated[0]!.end, null);
    assert.equal(gated[0]!.status, "PARTIAL_DATA");
  });

  it("15-20 winner/holdout/promotion/real_money/masaniello/repro", async () => {
    assert.throws(() => leakHoldoutModelSelection(true), ExperimentIntegrityError);
    assert.throws(() => leakAutoPromote031(true), ExperimentIntegrityError);
    assert.throws(() => leakMasanielloProduction("masaniello"), ExperimentIntegrityError);
    const a = await runTask031({ skipHeavy: true });
    const b = await runTask031({ skipHeavy: true });
    assert.equal(a.winner, null);
    assert.equal(a.auto_promotion, false);
    assert.equal(a.real_money, false);
    assert.equal(a.masaniello_production, false);
    assert.equal(a.HOLDOUT_TOUCHED, false);
    assert.equal(a.promotion, "BLOCKED");
    assert.equal(a.verdict, "INSUFFICIENT_DATA");
    assert.equal(a.model_ready, false);
    assert.equal(a.capital_test, false);
    assert.ok(runHostileBattery031().every((x) => x.throws));
    assert.equal(auditTask031(a).ok, true, auditTask031(a).failures.join(","));
    const cfg = loadExp031Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.masaniello_production, false);
    assert.equal(cfg.primary_risk_policy, "actuarial_v1");
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(
      verdict031({
        fixture: true,
        strictEvents: 3,
        modelReady: false,
        predictiveGate: false,
        huntExhausted: true,
      }),
      "INSUFFICIENT_DATA",
    );
    assert.equal(
      verdict031({
        fixture: false,
        strictEvents: 10,
        modelReady: false,
        predictiveGate: false,
        huntExhausted: true,
      }),
      "HARD_DATA_BLOCK",
    );
    assert.equal(
      verdict031({
        fixture: false,
        strictEvents: 10499,
        modelReady: true,
        predictiveGate: false,
        huntExhausted: true,
      }),
      "BREAKTHROUGH_NO_EDGE",
    );
  });
});
