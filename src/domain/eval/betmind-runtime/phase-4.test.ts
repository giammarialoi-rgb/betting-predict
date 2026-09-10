/**
 * Phase 4 — real event research: origin split, honest fetch, queue, temporal, gates.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectFootballDataArchive } from "@/domain/eval/data-intelligence/research/archive-lookup";
import { fetchEventPage, eventPageUrls } from "@/domain/eval/data-intelligence/research/event-page-fetch";
import { classifyHumanSourceStatus } from "@/domain/eval/betmind-runtime/explain/source-status";
import { buildResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";
import { buildHumanExplanation } from "@/domain/eval/betmind-runtime/explain/italian-explanation";
import { resolveEventTeamIdentity } from "@/domain/eval/betmind-runtime/explain/team-identity";
import { enqueueUpcomingEvents, pickResearchBatch } from "@/domain/eval/data-intelligence/research/queue";
import { RESEARCH_BUDGET_PER_CYCLE as ORCH_BUDGET } from "@/domain/eval/data-intelligence/research/orchestrator";
import { asOfAfterKickoff, isPostKickoff } from "@/domain/eval/data-intelligence/research/temporal";
import { decidePredictionAppend } from "@/domain/eval/permanent-044/prediction-precedence";
import type { PermanentPrediction044, PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";
import { preferredSources, FEATURE_SOURCE_PRIORITY } from "@/domain/eval/data-intelligence/research/data-priority";

function fakePred(
  partial: Partial<PermanentPrediction044> &
    Pick<PermanentPrediction044, "prediction_id" | "event_id" | "model_version" | "probability_model">,
): PermanentPrediction044 {
  return {
    timestamp: "2026-09-10T00:00:00Z",
    feature_version: "features_pi_v1",
    market: "1X2",
    selection: null,
    line: null,
    probability_market: null,
    edge_absolute: null,
    edge_relative: null,
    confidence_score: 50,
    data_quality_score: 0.5,
    recommended: false,
    reason_codes: [],
    risk_flags: [],
    human_readable_reason: "t",
    ranking_bucket: "NO_BET",
    prediction_seq: 1,
    immutable: true,
    ...partial,
  };
}

describe("Phase 4 Test A — archive priors are not silent live research", () => {
  it("splits live research 0 from historical derived features", () => {
    const matches = loadPiMatches();
    if (matches.length < 500) return;
    const arch = inspectFootballDataArchive({
      home: "Aston Villa",
      away: "Nottingham Forest",
      competition: "soccer_epl",
      kickoffIso: "2026-09-12T14:00:00Z",
    });
    assert.ok(arch.status === "SUCCESS" || arch.status === "PARTIAL", arch.reason);
    assert.ok(arch.prior_n_home >= 3);

    const summary = buildResearchSummary({
      home: "Aston Villa",
      away: "Nottingham Forest",
      features: [
        { name: "home_gf_l5", value: 1.4, source: "football-data-co-uk", status: "ELIGIBLE", entered_model: true },
        { name: "home_ga_l5", value: 1.2, source: "football-data-co-uk", status: "ELIGIBLE", entered_model: true },
        { name: "home_pts_l5", value: 1.6, source: "football-data-co-uk", status: "ELIGIBLE", entered_model: true },
        { name: "home_advantage", value: 1, source: "football-data-co-uk", status: "ELIGIBLE", entered_model: true },
      ],
      research: [
        {
          source_id: "football-data-co-uk",
          ok: true,
          fetched: true,
          phase: "OK",
          parser_status: "OK",
          fields_extracted: ["form_l5"],
        },
      ],
      prediction_time: "2026-09-10T00:00:00Z",
      model_version: "INDEPENDENT_POISSON_v1",
      feature_coverage: 0.06,
      has_independent_inference: true,
    });
    assert.equal(summary.origin.live_research_sources, 0);
    assert.ok(summary.origin.historical_prior_features >= 3);
    const hx = buildHumanExplanation({
      home: "Aston Villa",
      away: "Nottingham Forest",
      probability: { HOME: 0.44, DRAW: 0.27, AWAY: 0.29 },
      summary,
    });
    assert.match(hx.live_research, /0 fonti/);
    assert.match(hx.archive, /Football-Data|archivio/i);
    assert.match(hx.used.join(" "), /ultime 5 partite/i);
  });

  it("UEFA unmatched teams are not file-level SUCCESS", () => {
    const matches = loadPiMatches();
    if (matches.length < 500) return;
    const arch = inspectFootballDataArchive({
      home: "Slavia Praha",
      away: "RC Lens",
      competition: "soccer_uefa_champs_league",
      kickoffIso: "2026-09-17T19:00:00Z",
    });
    assert.notEqual(arch.status, "SUCCESS");
  });
});

describe("Phase 4 Test B — HTTP 403 is BLOCKED", () => {
  it("maps 403 fetch to BLOCKED and never SUCCESS", async () => {
    const prev = process.env.BETMIND_TEST_SCRAPE;
    process.env.BETMIND_TEST_SCRAPE = "true";
    try {
      const page = await fetchEventPage({
        sourceId: "sofascore",
        home: "Aston Villa",
        away: "Nottingham Forest",
        fetchImpl: async () => new Response("forbidden", { status: 403 }),
      });
      assert.equal(page.status, "BLOCKED");
      assert.equal(page.http_status, 403);
      assert.equal(page.fields_extracted.length, 0);
    } finally {
      if (prev == null) delete process.env.BETMIND_TEST_SCRAPE;
      else process.env.BETMIND_TEST_SCRAPE = prev;
    }
  });
});

describe("Phase 4 Test C — HTTP 200 without both teams is NO_EVENT", () => {
  it("does not treat homepage 200 as event data", async () => {
    const prev = process.env.BETMIND_TEST_SCRAPE;
    process.env.BETMIND_TEST_SCRAPE = "true";
    try {
      const page = await fetchEventPage({
        sourceId: "fbref",
        home: "Slavia Praha",
        away: "RC Lens",
        fetchImpl: async () =>
          new Response("<html><body>Premier League table Arsenal Chelsea</body></html>", { status: 200 }),
      });
      assert.equal(page.status, "NO_EVENT");
      assert.equal(page.http_status, 200);
    } finally {
      if (prev == null) delete process.env.BETMIND_TEST_SCRAPE;
      else process.env.BETMIND_TEST_SCRAPE = prev;
    }
  });

  it("Understat has no event-page URL (no EPL table false positive)", () => {
    assert.equal(eventPageUrls("understat", "Arsenal", "Chelsea"), "");
  });
});

describe("Phase 4 Test D — insufficient has no fake percentages", () => {
  it("explains missing data without HOME/DRAW/AWAY percents", () => {
    const summary = buildResearchSummary({
      home: "Omonoia",
      away: "Celta",
      features: [
        { name: "home_xg_prematch", value: null, source: "none", status: "UNAVAILABLE", entered_model: false },
      ],
      research: [],
      prediction_time: "2026-09-10T00:00:00Z",
      model_version: "INDEPENDENT_POISSON_v1",
      feature_coverage: 0.06,
      has_independent_inference: false,
    });
    const hx = buildHumanExplanation({
      home: "Omonoia",
      away: "Celta",
      probability: null,
      summary,
    });
    assert.equal(hx.prediction_lines.length, 0);
    assert.ok(hx.insufficient);
    assert.equal(/Casa \d/.test(hx.insufficient ?? ""), false);
  });
});

describe("Phase 4 Test E — post-kickoff excluded", () => {
  it("marks available_at after kickoff as POST_KICKOFF", () => {
    assert.equal(isPostKickoff("2026-09-12T16:00:00Z", "2026-09-12T14:00:00Z"), true);
    assert.equal(isPostKickoff("2026-09-12T13:00:00Z", "2026-09-12T14:00:00Z"), false);
    assert.equal(asOfAfterKickoff("2026-09-12T16:00:00Z", "2026-09-12T14:00:00Z"), true);
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "api-sports",
        ok: true,
        fetched: true,
        phase: "POST_KICKOFF",
        parser_status: "POST_KICKOFF",
        fields_extracted: ["home_injuries_n"],
        reason: "POST_KICKOFF",
      }),
      "POST_KICKOFF",
    );
  });
});

describe("Phase 4 Test F — stale worker cannot downgrade independent inference", () => {
  it("blocks NO_INDEPENDENT overwrite", () => {
    const existing = [
      fakePred({
        prediction_id: "a",
        event_id: "villa",
        model_version: "INDEPENDENT_POISSON_v1",
        probability_model: { HOME: 0.445, DRAW: 0.274, AWAY: 0.281 },
        reason_codes: ["INDEPENDENT_MODEL"],
        prediction_seq: 2,
      }),
    ];
    const candidate = fakePred({
      prediction_id: "c",
      event_id: "villa",
      model_version: "MODEL_v1|NO_INDEPENDENT",
      probability_model: null,
      reason_codes: ["NO_INDEPENDENT_MODEL"],
      prediction_seq: 3,
    });
    const d = decidePredictionAppend({ existing, candidate });
    assert.equal(d.action, "block");
  });
});

describe("Phase 4 identity + queue + provenance + gates", () => {
  it("marks live ids as provisional and never invents provider ids", () => {
    const id = resolveEventTeamIdentity({
      home: "Slavia Praha",
      away: "RC Lens",
      competition: "UEFA Champions League",
    });
    assert.equal(id.home.provider_ids.sofascore, null);
    assert.equal(id.away.provider_ids.understat, null);
    if (!id.home.matched) assert.equal(id.home.provisional, true);
  });

  it("research budget is 24 not a silent 8-event cap", () => {
    assert.equal(ORCH_BUDGET, 24);
    const root = mkdtempSync(join(tmpdir(), "bm-q-"));
    const nowMs = Date.parse("2026-09-10T08:00:00Z");
    const events = Array.from({ length: 30 }, (_, i) => ({
      event_id: `e${i}`,
      canonical_event_id: `e${i}`,
      source: "odds",
      source_event_id: `s${i}`,
      sport: "soccer",
      competition: "EPL",
      country: "GB",
      home_or_a: `Home ${i}`,
      away_or_b: `Away ${i}`,
      kickoff_utc: `2026-09-${String(11 + (i % 18)).padStart(2, "0")}T15:00:00Z`,
      collected_at_utc: "2026-09-10T00:00:00Z",
      available_at_utc: null,
      semantic_level: "RESEARCH",
      data_quality: 1,
      fingerprint: `f${i}`,
      status: "SCHEDULED",
    })) as PermanentEvent044[];
    const q = enqueueUpcomingEvents({ events, nowMs, nowIso: "2026-09-10T08:00:00Z", root });
    const batch = pickResearchBatch(q, 24, nowMs);
    assert.equal(batch.length, 24);
    assert.ok(q.items.length >= 24);
  });

  it("rolling features exclude the target match and record derived_from", () => {
    const matches = loadPiMatches();
    if (matches.length < 500) return;
    const targetMeta = resolveLivePiTarget({
      home_team: "Aston Villa",
      away_team: "Nottingham Forest",
      competition: "soccer_epl",
      matches,
    });
    const sample = matches.find(
      (m) => m.home_team_id === targetMeta.home_team_id && m.league === "E0",
    );
    if (!sample) return;
    const vec = buildFeatureVectorPi(sample, matches);
    const gf = vec.feature_data.find((d) => d.key === "home_gf_l5");
    assert.ok(gf);
    assert.ok((gf.derived_from ?? []).length > 0);
    assert.ok(!(gf.derived_from ?? []).includes(sample.canonical_id));
    assert.equal(gf.origin, "DERIVED");
  });

  it("does not lower model gates", () => {
    const src = readFileSync(
      join(process.cwd(), "src/domain/eval/predictive-intelligence/predict-live.ts"),
      "utf8",
    );
    assert.match(src, /missing_keys\.length > 45/);
    assert.match(src, /feature_coverage < 0\.35/);
  });

  it("prefers Understat before Opta for xG", () => {
    assert.equal(preferredSources("xg")[0], "understat");
    assert.equal(FEATURE_SOURCE_PRIORITY.form_results[0], "football-data-co-uk");
  });
});
