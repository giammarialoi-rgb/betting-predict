import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NEON_IN_USE } from "@/domain/storage";
import { assertPreMatchData, buildAsOfSnapshot, PreMatchLeakageError } from "@/domain/eval/real-pipeline/as-of-snapshot";
import { toSourceResultStatus } from "@/domain/eval/real-pipeline/source-status";
import { sliceDecisionFrom048 } from "@/domain/eval/real-pipeline/decision-label";
import { resolveLiveTeamId } from "@/domain/eval/predictive-intelligence/live-resolve";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { AsOfSnapshot } from "@/domain/eval/real-pipeline/types";

function event(partial: Partial<PermanentEvent044> = {}): PermanentEvent044 {
  return {
    event_id: "ev-future-1",
    canonical_event_id: "ev-future-1",
    source: "espn",
    source_event_id: "1",
    sport: "soccer",
    competition: "eng.1",
    country: null,
    home_or_a: "Alpha",
    away_or_b: "Beta",
    kickoff_utc: "2026-09-20T14:00:00.000Z",
    collected_at_utc: "2026-09-12T10:00:00.000Z",
    available_at_utc: "2026-09-12T10:00:00.000Z",
    semantic_level: "RESEARCH",
    data_quality: 0.4,
    fingerprint: "fp-1",
    status: "UPCOMING",
    origin: "DISCOVERED_LIVE",
    ...partial,
  };
}

describe("real-pipeline unit", () => {
  it("never uses Neon", () => {
    assert.equal(NEON_IN_USE, false);
  });

  it("resolves OpenLiga display names onto football-data raw team ids", () => {
    const matches = [
      {
        home_team: "Wolfsburg",
        away_team: "St Pauli",
        home_team_id: "raw:wolfsburg",
        away_team_id: "raw:st pauli",
        league: "D1",
      },
    ] as unknown as PiMatchRow[];
    const home = resolveLiveTeamId("FC St. Pauli", matches);
    const away = resolveLiveTeamId("VfL Wolfsburg", matches);
    assert.equal(home.matched, true);
    assert.equal(home.team_id, "raw:st pauli");
    assert.equal(away.matched, true);
    assert.equal(away.team_id, "raw:wolfsburg");
  });

  it("does not map UNAVAILABLE or NOT_CONFIGURED to ACTIVE", () => {
    assert.equal(toSourceResultStatus({ configured: false }), "NOT_CONFIGURED");
    assert.equal(toSourceResultStatus({ httpStatus: 0 }), "UNAVAILABLE");
    assert.equal(toSourceResultStatus({ acquisition: "AUTH_REQUIRED" }), "NOT_CONFIGURED");
    assert.equal(toSourceResultStatus({ acquisition: "BLOCKED" }), "BLOCKED");
    assert.equal(toSourceResultStatus({ httpStatus: 200, extracted: 3 }), "ACTIVE");
    assert.notEqual(toSourceResultStatus({ httpStatus: 0 }), "ACTIVE");
    assert.notEqual(toSourceResultStatus({ configured: false, httpStatus: 200, extracted: 9 }), "ACTIVE");
  });

  it("maps 048 decisions onto BET | WATCH | NO BET | INSUFFICIENT DATA", () => {
    assert.equal(sliceDecisionFrom048("BET_CANDIDATE"), "BET");
    assert.equal(sliceDecisionFrom048("STRONG_CANDIDATE"), "BET");
    assert.equal(sliceDecisionFrom048("MODEL_UNCERTAIN"), "WATCH");
    assert.equal(sliceDecisionFrom048("NO_BET"), "NO BET");
    assert.equal(sliceDecisionFrom048("INSUFFICIENT_DATA"), "INSUFFICIENT DATA");
  });

  it("assertPreMatchData accepts a clean pre-kickoff snapshot", () => {
    const snap = buildAsOfSnapshot({
      event: event(),
      asOf: "2026-09-12T12:00:00.000Z",
      observations: [
        {
          event_id: "ev-future-1",
          feature_key: "clubelo.home",
          value: 1700,
          source: "clubelo",
          source_url: null,
          observed_at: "2026-09-12T11:00:00.000Z",
          available_at: "2026-09-12T11:00:00.000Z",
          extraction_method: "csv",
          confidence: 0.8,
          status: "REAL",
          kind: "HISTORICAL_PRIOR",
          enters_independent_model: true,
        },
      ],
    });
    assert.equal(snap.ft_score, null);
    assert.doesNotThrow(() => assertPreMatchData(snap, "2026-09-20T14:00:00.000Z"));
  });

  it("assertPreMatchData fails on post-asOf leakage and FT scores in the model", () => {
    const leak: AsOfSnapshot = {
      event_id: "ev-future-1",
      asOf: "2026-09-12T12:00:00.000Z",
      kickoff_utc: "2026-09-20T14:00:00.000Z",
      home: "Alpha",
      away: "Beta",
      competition: "eng.1",
      fields: [
        {
          key: "clubelo.home",
          value: 1700,
          provenance: {
            source_id: "clubelo",
            observed_at: "2026-09-12T18:00:00.000Z",
            available_at: "2026-09-12T18:00:00.000Z",
            extraction_method: "csv",
            epistemic_kind: "QUANTITATIVE_EVIDENCE",
          },
          enters_model: true,
          temporal_precision: "exact",
        },
      ],
      market_fields: [],
      blockedByTemporal: [],
      ft_score: null,
    };
    assert.throws(() => assertPreMatchData(leak, "2026-09-20T14:00:00.000Z"), PreMatchLeakageError);

    const ft: AsOfSnapshot = {
      ...leak,
      fields: [
        {
          key: "fthg",
          value: 2,
          provenance: {
            source_id: "espn",
            observed_at: "2026-09-12T11:00:00.000Z",
            available_at: "2026-09-12T11:00:00.000Z",
            extraction_method: "scoreboard",
            epistemic_kind: "FACT",
          },
          enters_model: true,
          temporal_precision: "exact",
        },
      ],
    };
    assert.throws(() => assertPreMatchData(ft, "2026-09-20T14:00:00.000Z"), PreMatchLeakageError);
  });

  it("coerces RFC 2822 news available_at to ISO and does not abort ANALYZE_EVENT", () => {
    const snap = buildAsOfSnapshot({
      event: event(),
      asOf: "2026-09-12T12:00:00.000Z",
      observations: [
        {
          event_id: "ev-future-1",
          feature_key: "news_other",
          value: "Dortmund host Paderborn",
          source: "bbc-sport",
          source_url: "https://example.test/rss",
          observed_at: "2026-09-12T11:00:00.000Z",
          available_at: "Sat, 12 Sep 2026 10:15:00 +0000",
          extraction_method: "public_rss",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        },
      ],
    });
    const news = snap.fields.find((f) => f.key === "news_other");
    assert.ok(news);
    assert.equal(news!.provenance.available_at, "2026-09-12T10:15:00.000Z");
    assert.equal(news!.enters_model, false);
    assert.equal(news!.temporal_precision, "exact");
    assert.doesNotThrow(() => assertPreMatchData(snap, "2026-09-20T14:00:00.000Z"));
  });

  it("omits unparseable available_at on CONTEXT news instead of crashing", () => {
    const snap = buildAsOfSnapshot({
      event: event(),
      asOf: "2026-09-12T12:00:00.000Z",
      observations: [
        {
          event_id: "ev-future-1",
          feature_key: "news_other",
          value: "preview notes",
          source: "ansa",
          source_url: null,
          observed_at: "2026-09-12T11:00:00.000Z",
          available_at: "not-a-date",
          extraction_method: "public_rss",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        },
        {
          event_id: "ev-future-1",
          feature_key: "news_injury",
          value: "",
          source: "gazzetta",
          source_url: null,
          observed_at: "2026-09-12T11:00:00.000Z",
          available_at: "",
          extraction_method: "public_rss",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        },
      ],
    });
    const junk = snap.fields.find((f) => f.key === "news_other");
    const empty = snap.fields.find((f) => f.key === "news_injury");
    assert.ok(junk);
    assert.equal(junk!.provenance.available_at, null);
    assert.equal(junk!.temporal_precision, "unknown");
    assert.equal(junk!.enters_model, false);
    assert.equal(empty!.provenance.available_at, null);
    assert.doesNotThrow(() => assertPreMatchData(snap, "2026-09-20T14:00:00.000Z"));
  });

  it("does not let a REAL field enter the model when available_at is unparseable", () => {
    const snap = buildAsOfSnapshot({
      event: event(),
      asOf: "2026-09-12T12:00:00.000Z",
      observations: [
        {
          event_id: "ev-future-1",
          feature_key: "clubelo.home",
          value: 1700,
          source: "clubelo",
          source_url: null,
          observed_at: "2026-09-12T11:00:00.000Z",
          available_at: "soon",
          extraction_method: "csv",
          confidence: 0.8,
          status: "REAL",
          kind: "HISTORICAL_PRIOR",
          enters_independent_model: true,
        },
      ],
    });
    const elo = snap.fields.find((f) => f.key === "clubelo.home");
    assert.ok(elo);
    assert.equal(elo!.provenance.available_at, null);
    assert.equal(elo!.enters_model, false);
    assert.equal(elo!.temporal_precision, "unknown");
    assert.doesNotThrow(() => assertPreMatchData(snap, "2026-09-20T14:00:00.000Z"));
  });

  it("still fail-closes a hand-built snapshot that marks enters_model with unknown available_at", () => {
    const leak: AsOfSnapshot = {
      event_id: "ev-future-1",
      asOf: "2026-09-12T12:00:00.000Z",
      kickoff_utc: "2026-09-20T14:00:00.000Z",
      home: "Alpha",
      away: "Beta",
      competition: "eng.1",
      fields: [
        {
          key: "clubelo.home",
          value: 1700,
          provenance: {
            source_id: "clubelo",
            observed_at: "2026-09-12T11:00:00.000Z",
            available_at: "not-a-date",
            extraction_method: "csv",
            epistemic_kind: "QUANTITATIVE_EVIDENCE",
          },
          enters_model: true,
          temporal_precision: "unknown",
        },
      ],
      market_fields: [],
      blockedByTemporal: [],
      ft_score: null,
    };
    assert.throws(() => assertPreMatchData(leak, "2026-09-20T14:00:00.000Z"), PreMatchLeakageError);
  });
});
