import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { auditTask023 } from "@/domain/eval/temporal-023/audit";
import {
  asOfFromKickoff,
  canonicalSnapshotAt,
  lastTickForSelectionAtOrBefore,
  windowCoverage,
} from "@/domain/eval/temporal-023/asof";
import { classifyPhase, secondsToKickoff } from "@/domain/eval/temporal-023/classify";
import { computeClvAfterLock } from "@/domain/eval/temporal-023/clv";
import { matchOddsFixturePath, loadExp023Config } from "@/domain/eval/temporal-023/config";
import { decideVerdict, runTask023 } from "@/domain/eval/temporal-023/lab";
import {
  leakAFtInDecision,
  leakBFutureSnapshot,
  leakCCloseBeforeLock,
  leakDPostMatchStat,
  leakEOutcomeInEvidence,
  leakFTimestampAfterAsOf,
  leakGMatchProbable,
  leakHUnknownInStrict,
  leakL10StrategyChosenFromPnl,
} from "@/domain/eval/temporal-023/leakage";
import { parseMcmNdjson, settlementAfterLock, latestDefinition } from "@/domain/eval/temporal-023/parse-mcm";
import { MATCH_ODDS_FIXTURE_SHA256 } from "@/domain/eval/temporal-023/types";
import { createHash } from "node:crypto";

const FIXTURE = readFileSync(matchOddsFixturePath(), "utf8");
const KICKOFF = "2017-04-30T13:05:00.000Z";
const HOME_ID = 63907;
const DRAW_ID = 58805;

describe("TASK 023 temporal odds breakthrough", () => {
  it("fixture hash and real MCM MATCH_ODDS clocks", () => {
    const buf = readFileSync(matchOddsFixturePath());
    assert.equal(createHash("sha256").update(buf).digest("hex"), MATCH_ODDS_FIXTURE_SHA256);
    const parsed = parseMcmNdjson(FIXTURE);
    assert.equal(parsed.parseFail, 0);
    assert.equal(parsed.eventIds[0], "28202626");
    assert.ok(parsed.ticks.length >= 10);
    assert.equal(parsed.batbCount, 0);
    assert.equal(parsed.atbCount, 0);
    assert.equal(parsed.atlCount, 0);
    const md = parsed.definitions[0];
    assert.equal(md?.marketType, "MATCH_ODDS");
    assert.equal(md?.marketStartTime, KICKOFF);
    assert.equal(md?.timezone, "Europe/London");
    assert.ok(md?.marketStartTime?.endsWith("Z"));
    assert.ok(parsed.ticks.every((t) => t.temporalPrecision === "exact"));
    assert.ok(parsed.ticks.some((t) => t.phase === "PREMATCH"));
    assert.ok(parsed.ticks.some((t) => t.phase === "INPLAY"));
  });

  it("PREMATCH requires publishTime < marketStartTime, not inPlay=false", () => {
    assert.equal(
      classifyPhase({
        publishTimeMs: Date.parse(KICKOFF) - 60_000,
        marketStartTimeIso: KICKOFF,
        status: "OPEN",
      }),
      "PREMATCH",
    );
    assert.equal(
      classifyPhase({
        publishTimeMs: Date.parse(KICKOFF) + 60_000,
        marketStartTimeIso: KICKOFF,
        status: "OPEN",
      }),
      "INPLAY",
    );
    const afterKickoffInPlayFalse = parseMcmNdjson(
      JSON.stringify({
        op: "mcm",
        pt: Date.parse(KICKOFF) + 120_000,
        mc: [
          {
            id: "1.9",
            marketDefinition: {
              marketType: "MATCH_ODDS",
              marketTime: KICKOFF,
              inPlay: false,
              status: "OPEN",
              eventId: "x",
              eventName: "A v B",
              runners: [{ id: 1, name: "A", status: "ACTIVE", sortPriority: 1 }],
            },
            rc: [{ id: 1, ltp: 2.1 }],
          },
        ],
      }),
    );
    assert.equal(afterKickoffInPlayFalse.ticks[0]?.inPlay, false);
    assert.equal(afterKickoffInPlayFalse.ticks[0]?.phase, "INPLAY");
    assert.ok((afterKickoffInPlayFalse.ticks[0]?.secondsToKickoff ?? 0) < 0);
  });

  it("UNKNOWN without kickoff cannot enter STRICT", () => {
    const parsed = parseMcmNdjson(
      JSON.stringify({
        op: "mcm",
        pt: 1_493_129_993_643,
        mc: [{ id: "1.8", rc: [{ id: 1, ltp: 2.2 }] }],
      }),
    );
    assert.equal(parsed.ticks[0]?.phase, "UNKNOWN");
    assert.equal(parsed.ticks[0]?.secondsToKickoff, null);
    assert.throws(
      () => leakHUnknownInStrict({ precision: "unknown", phase: "UNKNOWN" }),
      BlindLeakageError,
    );
  });

  it("as-of uses last tick ≤ asOf and never a later tick", () => {
    const parsed = parseMcmNdjson(FIXTURE);
    const asOf72 = asOfFromKickoff(KICKOFF, 72 * 3600);
    const none = lastTickForSelectionAtOrBefore({
      ticks: parsed.ticks,
      asOfMs: asOf72.getTime(),
      selectionId: HOME_ID,
    });
    assert.equal(none, null);
    const snap72 = canonicalSnapshotAt({
      eventId: "28202626",
      kickoff: KICKOFF,
      asOf: asOf72,
      market: "MATCH_ODDS",
      selection: "HOME",
      ticks: parsed.ticks,
      selectionId: HOME_ID,
      source: "test",
    });
    assert.equal(snap72.status, "NO_DATA_AT_ASOF");
    const asOf1h = asOfFromKickoff(KICKOFF, 3600);
    const tick = lastTickForSelectionAtOrBefore({
      ticks: parsed.ticks,
      asOfMs: asOf1h.getTime(),
      selectionId: HOME_ID,
    });
    assert.ok(tick);
    assert.ok(tick.publishTimeMs <= asOf1h.getTime());
    assert.equal(tick.phase, "PREMATCH");
    const later = parsed.ticks.filter(
      (t) => t.selectionId === HOME_ID && t.publishTimeMs > asOf1h.getTime(),
    );
    assert.ok(later.length >= 0);
    if (later[0]) {
      assert.ok(tick.publishTimeMs !== later[0].publishTimeMs || tick.publishTimeMs <= asOf1h.getTime());
    }
    const cov = windowCoverage({
      kickoff: KICKOFF,
      ticks: parsed.ticks,
      selectionIds: [HOME_ID, DRAW_ID, 47999],
    });
    const w72 = cov.find((c) => c.window === "72h");
    const w1h = cov.find((c) => c.window === "1h");
    assert.equal(w72?.coverage, 0);
    assert.ok((w1h?.coverage ?? 0) > 0);
  });

  it("seconds_to_kickoff = marketStartTime - publishTime", () => {
    const parsed = parseMcmNdjson(FIXTURE);
    const t = parsed.ticks.find((x) => x.phase === "PREMATCH");
    assert.ok(t);
    assert.equal(t.secondsToKickoff, secondsToKickoff(KICKOFF, t.publishTimeMs));
    assert.ok((t.secondsToKickoff ?? 0) > 0);
  });

  it("CLV only after LOCK; settlement WINNER is post-LOCK", () => {
    assert.throws(
      () => computeClvAfterLock({ locked: false, entryPrice: 3, closingPrice: 2.5 }),
      BlindLeakageError,
    );
    const clv = computeClvAfterLock({ locked: true, entryPrice: 3, closingPrice: 2.5 });
    assert.ok(clv.impliedDelta > 0);
    const parsed = parseMcmNdjson(FIXTURE);
    const closed = latestDefinition(parsed, "1.131162837");
    const settled = settlementAfterLock(closed);
    assert.equal(settled.winner, "DRAW");
  });

  it("hostile leakage A–H hard-fail", () => {
    const asOf = new Date("2017-04-30T12:05:00.000Z");
    assert.throws(() => leakAFtInDecision({ FT: 1 }), BlindLeakageError);
    assert.throws(() => leakBFutureSnapshot("2017-04-30T12:06:00.000Z", asOf), BlindLeakageError);
    assert.throws(() => leakCCloseBeforeLock({ locked: false, usedClose: true }), BlindLeakageError);
    leakCCloseBeforeLock({ locked: true, usedClose: true });
    assert.throws(() => leakDPostMatchStat("FT"), BlindLeakageError);
    assert.throws(() => leakEOutcomeInEvidence({ outcome: "DRAW" }), BlindLeakageError);
    assert.throws(() => leakFTimestampAfterAsOf("2017-04-30T13:00:00.000Z", asOf), BlindLeakageError);
    assert.throws(() => leakGMatchProbable("MATCH_PROBABLE"), BlindLeakageError);
    assert.throws(
      () => leakHUnknownInStrict({ precision: "exact", phase: "UNKNOWN" }),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        leakL10StrategyChosenFromPnl({
          selectedFromPnl: true,
          autoPromote: false,
          best: null,
        }),
      ExperimentIntegrityError,
    );
  });

  it("frozen config and verdict helpers", () => {
    const cfg = loadExp023Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.declared_edge, false);
    assert.equal(cfg.frozen_model_id, "market_only");
    assert.deepEqual(cfg.holdout_years, [2020]);
    assert.equal(decideVerdict({ officialBulk: false, strictEvents: 1, timestampObs: 50, formatValid: true }), "PARTIAL_STRICT");
    assert.equal(
      decideVerdict({ officialBulk: true, strictEvents: 100, timestampObs: 1000, formatValid: true }),
      "STRICT_UNLOCKED",
    );
    assert.equal(
      decideVerdict({ officialBulk: false, strictEvents: 0, timestampObs: 0, formatValid: true }),
      "ACQUISITION_BLOCKED",
    );
  });

  it("lab: PARTIAL_STRICT, 1 mirror event, 0 bets, no silent 1000, leakage armed", async () => {
    const report = await runTask023({ allowNetwork: false });
    assert.equal(report.verdict, "PARTIAL_STRICT");
    assert.equal(report.winner, null);
    assert.equal(report.real_money, false);
    assert.equal(report.official_bulk_acquired, false);
    assert.equal(report.source_class_primary, "MIRROR");
    assert.equal(report.scientific.strict_events, 1);
    assert.equal(report.scientific.official_strict_events, 0);
    assert.equal(report.scientific.acceptance_100_events, false);
    assert.equal(report.counts.bets, 0);
    assert.equal(report.blind.decision, "NO_BET");
    assert.equal(report.blind.locked, true);
    assert.equal(report.blind.clv.used_in_decision, false);
    assert.equal(report.blind.clv.computed_after_lock, true);
    assert.ok(report.blind.assessment.toLowerCase().includes("insufficient"));
    assert.ok(report.leakage.every((l) => l.throws));
    assert.equal(report.market_row.model_ready, false);
    assert.equal(report.market_row.lifecycle, "TEMPORALLY_VALID");
    const y2017 = report.annual.find((a) => a.year === 2017);
    assert.ok(y2017);
    assert.equal(y2017.status, "INSUFFICIENT_DATA");
    assert.equal(y2017.start, 1000);
    assert.equal(y2017.end, null);
    assert.equal(y2017.bets, 0);
    const y2019 = report.annual.find((a) => a.year === 2019);
    assert.equal(y2019?.status, "NOT_ACQUIRED");
    assert.equal(y2019?.end, null);
    assert.equal(report.scientific.best_model, null);
    assert.equal(report.HOLDOUT_TOUCHED, false);
    assert.ok(report.models.every((m) => m.used_for_capital === false && m.significant === false));
    const audit = auditTask023(report);
    assert.equal(audit.ok, true, audit.failures.join(","));
  });
});
