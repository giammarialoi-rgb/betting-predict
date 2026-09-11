/**
 * Phase 3D — pipeline counters + catalogue honesty + dossier lineage.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computePipelineCounters3d } from "@/domain/eval/betmind-runtime/pipeline-counters";
import { RESEARCH_SOURCE_CATALOGUE } from "@/domain/eval/data-intelligence/research/source-catalogue";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import { appendResearchStatus } from "@/domain/eval/data-intelligence/research/status";

describe("Phase 3D pipeline counters", () => {
  it("does not treat prediction rows as model inferences", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-3d-"));
    writeFileSync(
      join(root, "events.jsonl"),
      `${JSON.stringify({
        event_id: "e1",
        home_or_a: "A",
        away_or_b: "B",
        competition: "x",
        kickoff_utc: "2026-09-12T14:00:00Z",
        sport: "soccer",
        status: "SCHEDULED",
      })}\n`,
      "utf8",
    );
    writeFileSync(
      join(root, "predictions.jsonl"),
      `${JSON.stringify({
        event_id: "e1",
        prediction_id: "p1",
        timestamp: "2026-09-09T12:00:00Z",
        probability_model: null,
        probability_market: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
        model_version: "MODEL_v1|NO_INDEPENDENT",
        reason_codes: ["INSUFFICIENT_DATA", "NO_INDEPENDENT_MODEL", "FEATURES_TOO_SPARSE"],
        confidence_score: 10,
        edge_absolute: null,
      })}\n`,
      "utf8",
    );
    writeFileSync(join(root, "research-status.jsonl"), "", "utf8");

    const c = computePipelineCounters3d(root);
    assert.equal(c.events_discovered, 1);
    assert.equal(c.predictions_persisted_events, 1);
    assert.equal(c.model_inferences, 0);
    assert.equal(c.insufficient_data, 1);
    assert.equal(c.no_independent_model, 1);
    assert.equal(c.no_independent_features, 0);
    assert.match(c.legacy_analyzed_meaning, /NOT mean independent model inference/i);
  });

  it("counts research fetches and multi-source", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-3d-r-"));
    writeFileSync(join(root, "events.jsonl"), "", "utf8");
    writeFileSync(join(root, "predictions.jsonl"), "", "utf8");
    appendResearchStatus(
      {
        event_id: "e2",
        source_id: "understat",
        phase: "OK",
        ok: true,
        fetched: true,
        fetched_at: "2026-09-09T12:00:00Z",
        available_at: null,
        reason: "probe_OK",
        enters_independent_model: false,
        raw_ref: null,
        cycle_number: 1,
        at: "2026-09-09T12:00:00Z",
      },
      root,
    );
    appendResearchStatus(
      {
        event_id: "e2",
        source_id: "uefa",
        phase: "OK",
        ok: true,
        fetched: true,
        fetched_at: "2026-09-09T12:00:00Z",
        available_at: null,
        reason: "probe_OK",
        enters_independent_model: false,
        raw_ref: null,
        cycle_number: 1,
        at: "2026-09-09T12:00:00Z",
      },
      root,
    );
    const c = computePipelineCounters3d(root);
    assert.equal(c.events_with_research, 1);
    assert.equal(c.events_with_multi_research_sources, 1);
  });
});

describe("Phase 3D source catalogue", () => {
  it("marks missing adapters explicitly and never claims odds as model", () => {
    const missing = RESEARCH_SOURCE_CATALOGUE.filter((s) => s.adapter === "MISSING_ADAPTER");
    assert.ok(missing.length >= 10, "expected many MISSING_ADAPTER rows");
    const odds = RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === "the-odds-api");
    assert.equal(odds?.market_layer, true);
    const directa = RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === "directa");
    assert.equal(directa?.adapter, "TEST_PROBE");
    const flashscore = RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === "flashscore");
    assert.equal(flashscore?.adapter, "TEST_PROBE");
    const understat = RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === "understat");
    assert.equal(understat?.adapter, "PRODUCTION_ADAPTER");
    assert.equal(understat?.market_layer, false);
  });
});

describe("Phase 3D dossier lineage", () => {
  it("answers acceptance questions and odds_entered_model=false", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-3d-d-"));
    mkdirSync(join(root, "brain"), { recursive: true });
    mkdirSync(join(root, "predictive-intelligence", "reasoning"), { recursive: true });
    writeFileSync(
      join(root, "brain", "brain-state.json"),
      JSON.stringify({
        status: "RUNNING",
        cycles_completed: 624,
        model_version: "MODEL_v2_DECISION_ENGINE",
        last_cycle_at: "2026-09-09T23:00:00Z",
        last_successful_cycle_at: "2026-09-09T23:00:00Z",
      }),
      "utf8",
    );
    writeFileSync(
      join(root, "events.jsonl"),
      `${JSON.stringify({
        event_id: "ev-lineage",
        home_or_a: "Aston Villa",
        away_or_b: "Nottingham Forest",
        competition: "soccer_epl",
        kickoff_utc: "2026-09-12T14:00:00Z",
        sport: "soccer",
        status: "SCHEDULED",
      })}\n`,
      "utf8",
    );
    writeFileSync(
      join(root, "predictions.jsonl"),
      `${JSON.stringify({
        event_id: "ev-lineage",
        prediction_id: "px",
        timestamp: "2026-09-09T23:42:00Z",
        probability_model: null,
        probability_market: { HOME: 0.44, DRAW: 0.28, AWAY: 0.28 },
        model_version: "MODEL_v1|NO_INDEPENDENT",
        reason_codes: ["INSUFFICIENT_DATA", "NO_INDEPENDENT_MODEL"],
        confidence_score: 12,
        edge_absolute: null,
      })}\n`,
      "utf8",
    );
    writeFileSync(
      join(root, "predictive-intelligence", "reasoning", "snapshots.jsonl"),
      `${JSON.stringify({
        event_id: "ev-lineage",
        at: "2026-09-09T23:42:00Z",
        model_version: "MODEL_v1|NO_INDEPENDENT",
        feature_snapshot: { home_gf_l3: null, strength_diff_pts: 0 },
        feature_data: [
          {
            key: "home_gf_l3",
            source: "football-data-co-uk",
            event_id: "ev-lineage",
            available_at: null,
            feature_time: "2026-09-12T00:00:00.000Z",
            value: null,
            quality: 0,
            status: "NOT_ELIGIBLE",
            temporal_precision: "DATE_ONLY",
          },
        ],
        feature_coverage: 0,
        model_probability: null,
        market_probability: { HOME: 0.44 },
      })}\n`,
      "utf8",
    );
    appendResearchStatus(
      {
        event_id: "ev-lineage",
        source_id: "fbref",
        phase: "BLOCKED",
        ok: false,
        fetched: true,
        fetched_at: "2026-09-09T23:34:00Z",
        available_at: null,
        reason: "HTTP_403",
        enters_independent_model: false,
        raw_ref: "abc",
        cycle_number: 624,
        at: "2026-09-09T23:34:00Z",
        url: "https://fbref.com/en/",
        http_status: 403,
        parser_status: "BLOCKED",
        fields_extracted: [],
        adapter_kind: "TEST_PROBE",
      },
      root,
    );

    appendResearchStatus(
      {
        event_id: "ev-lineage",
        source_id: "understat",
        phase: "OK",
        ok: true,
        fetched: true,
        fetched_at: "2026-09-09T23:34:00Z",
        available_at: null,
        reason: "Prior xG only. source=getLeagueData",
        enters_independent_model: false,
        raw_ref: "understat:99",
        cycle_number: 624,
        at: "2026-09-09T23:34:00Z",
        url: "https://understat.com/getLeagueData/EPL/2026",
        http_status: 200,
        parser_status: "SUCCESS",
        fields_extracted: ["home_xg_l5", "away_xg_prematch"],
        adapter_kind: "TEST_PROBE",
      },
      root,
    );

    const d = buildAnalysisDossier("ev-lineage", root);
    assert.ok(d);
    assert.equal(d!.lineage.odds_entered_model, false);
    assert.ok(d!.lineage.what_betmind_knew_before_kickoff.includes("No independent"));
    assert.ok(d!.lineage.sources_consulted.includes("fbref"));
    assert.ok(Array.isArray(d!.lineage.catalogue_noted_not_fetched));
    assert.equal(d!.lineage.features_entered_model.length, 0);
    assert.equal(d!.research.find((r) => r.source_id === "fbref")?.http_status, 403);
    assert.equal(d!.research.find((r) => r.source_id === "understat")?.adapter_kind, "PRODUCTION_ADAPTER");
    assert.equal(d!.independent_model.probability, null);
  });
});
