/**
 * Phase 3F — explanation, source taxonomy, team identity, odds firewall, temporal.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { featureLabelIt, classifyFeatureQuality } from "@/domain/eval/betmind-runtime/explain/feature-dictionary";
import { classifyHumanSourceStatus } from "@/domain/eval/betmind-runtime/explain/source-status";
import { buildResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";
import { buildHumanExplanation } from "@/domain/eval/betmind-runtime/explain/italian-explanation";
import { assertIndependentOddsFirewall } from "@/domain/eval/betmind-runtime/explain/odds-firewall";
import { resolveLiveTeamId } from "@/domain/eval/predictive-intelligence/live-resolve";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import {
  priorMatchesAsOf,
  featureCutoffForMatch,
  assertNoFutureLeakage,
  assertNoMarketInputsInPredictionContext,
} from "@/domain/eval/predictive-intelligence/features/asof";
import { predictPoissonIndependentDetailed } from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import type { PiFeatureVector } from "@/domain/eval/predictive-intelligence/types";

describe("Phase 3F feature dictionary", () => {
  it("translates rolling keys with team names and does not invent unknown keys", () => {
    assert.equal(
      featureLabelIt("home_gf_l5", "Aston Villa", "Nottingham Forest"),
      "Gol segnati da Aston Villa nelle ultime 5 partite (media)",
    );
    assert.match(featureLabelIt("unknown_xyz", "A", "B"), /non in dizionario/);
    assert.equal(
      classifyFeatureQuality({
        key: "home_pts_l5",
        value: 1.8,
        status: "ELIGIBLE",
        entered_model: true,
        source: "football-data-co-uk",
      }),
      "HISTORICAL_PRIOR",
    );
    assert.equal(
      classifyFeatureQuality({
        key: "home_xg_prematch",
        value: null,
        status: "UNAVAILABLE",
        entered_model: false,
      }),
      "MISSING",
    );
  });
});

describe("Phase 3F source taxonomy", () => {
  it("maps 403 to BLOCKED and missing adapter honestly", () => {
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "sofascore",
        ok: false,
        fetched: true,
        phase: "BLOCKED",
        http_status: 403,
      }),
      "BLOCKED",
    );
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "whoscored",
        ok: false,
        fetched: false,
        phase: "MISSING_ADAPTER",
        adapter_kind: "MISSING_ADAPTER",
      }),
      "MISSING_ADAPTER",
    );
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "directa",
        ok: false,
        fetched: false,
        phase: "DENIED",
        adapter_kind: "POLICY_DENIED",
        reason: "DISABLED_BY_POLICY",
      }),
      "DISABLED_BY_POLICY",
    );
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "fbref",
        ok: true,
        fetched: true,
        phase: "OK",
        http_status: 200,
        adapter_kind: "TEST_PROBE",
        fields_extracted: ["page_mentions_both_teams"],
        reason: "SITE_PROBE (homepage, not match page)",
      }),
      "PARTIAL",
    );
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "understat",
        ok: true,
        fetched: true,
        phase: "OK",
        http_status: 200,
        adapter_kind: "PRODUCTION_ADAPTER",
        parser_status: "SUCCESS",
        fields_extracted: ["home_xg_l5", "away_xg_l5", "home_xg_prematch"],
        reason: "Prior xG only (excluded_target=true). source=getLeagueData",
      }),
      "SUCCESS",
    );
  });
});

describe("Phase 3F explanation never hallucinates", () => {
  it("does not mention xG or injuries when they are missing", () => {
    const summary = buildResearchSummary({
      home: "Aston Villa",
      away: "Nottingham Forest",
      features: [
        {
          name: "home_gf_l5",
          value: 1,
          source: "football-data-co-uk",
          status: "ELIGIBLE",
          entered_model: true,
        },
        {
          name: "home_xg_prematch",
          value: null,
          source: "none",
          status: "UNAVAILABLE",
          entered_model: false,
        },
        {
          name: "home_injuries_n",
          value: null,
          source: "none",
          status: "UNAVAILABLE",
          entered_model: false,
        },
      ],
      research: [
        {
          source_id: "sofascore",
          ok: false,
          fetched: true,
          phase: "BLOCKED",
          http_status: 403,
          fields_extracted: [],
        },
        {
          source_id: "tennis-abstract",
          ok: false,
          fetched: false,
          phase: "MISSING_ADAPTER",
          adapter_kind: "MISSING_ADAPTER",
          fields_extracted: [],
        },
        {
          source_id: "football-data-co-uk",
          ok: true,
          fetched: true,
          phase: "OK",
          parser_status: "CACHE_PRESENT",
          fields_extracted: ["form_l5"],
        },
      ],
      prediction_time: "2026-09-10T00:27:32.816Z",
      model_version: "INDEPENDENT_POISSON_v1",
      feature_coverage: 1,
      has_independent_inference: true,
    });
    const hx = buildHumanExplanation({
      home: "Aston Villa",
      away: "Nottingham Forest",
      probability: { HOME: 0.445, DRAW: 0.274, AWAY: 0.281 },
      summary,
    });
    const blob = `${hx.analyzed} ${hx.why.join(" ")} ${hx.used.join(" ")}`;
    assert.equal(/l'xG indica|xg indica/i.test(blob), false);
    assert.equal(summary.source_rows.some((r) => r.source_id === "sofascore"), false);
    assert.equal(summary.source_rows.some((r) => r.source_id === "tennis-abstract"), false);
    assert.equal(summary.sources_missing_adapter, 0);
    assert.equal(/adapter mancante|Adapter non implementato/i.test(hx.sources_summary), false);
    assert.equal(/SofaScore|Tennis Abstract/i.test(hx.sources_summary + hx.missing.join(" ")), false);
    assert.ok(hx.used.some((u) => /Gol segnati da Aston Villa/.test(u)));
    assert.ok(hx.odds_sentence.includes("non sono entrate"));
    assert.ok(hx.facts_used.includes("odds_entered_model=false"));
    assert.ok(hx.why.some((w) => /non dispone ancora di una misura affidabile/.test(w)));
  });

  it("explains insufficient events without fake percentages", () => {
    const summary = buildResearchSummary({
      home: "A",
      away: "B",
      features: [],
      research: [],
      prediction_time: "2026-09-10T00:00:00Z",
      model_version: "INDEPENDENT_POISSON_v1",
      feature_coverage: 0.07,
      has_independent_inference: false,
    });
    const hx = buildHumanExplanation({
      home: "A",
      away: "B",
      probability: null,
      summary,
    });
    assert.ok(hx.insufficient);
    assert.equal(hx.prediction_lines.length, 0);
    assert.match(hx.insufficient!, /non ha prodotto una previsione indipendente/i);
  });
});

describe("Phase 3F odds firewall", () => {
  it("fails hard if odds keys enter the independent vector", () => {
    assert.throws(() =>
      assertIndependentOddsFirewall({
        featureKeys: ["home_gf_l5", "market_prob_home"],
      }),
    );
    assert.doesNotThrow(() =>
      assertIndependentOddsFirewall({
        featureKeys: ["home_gf_l5", "strength_diff_pts"],
        enteredKeys: ["home_gf_l5"],
        oddsEnteredModel: false,
      }),
    );
  });
});

describe("Phase 3F team identity", () => {
  it("resolves Nottingham Forest aliases to one canonical id when dataset present", () => {
    const matches = loadPiMatches();
    if (matches.length < 500) return;
    const a = resolveLiveTeamId("Nottingham Forest", matches);
    const b = resolveLiveTeamId("nottingham forest", matches);
    const c = resolveLiveTeamId("Nott'm Forest", matches);
    assert.equal(a.team_id, "nottingham-forest");
    assert.equal(b.team_id, a.team_id);
    assert.equal(c.team_id, a.team_id);
  });
});

describe("Phase 3F temporal leakage", () => {
  it("priors exclude the target match and future results", () => {
    const target = {
      canonical_id: "t1",
      match_date: "2026-09-12",
      result_available_at: "2026-09-13T00:00:00.000Z",
    } as const;
    const universe = [
      { canonical_id: "old", match_date: "2026-09-01", result_available_at: "2026-09-02T00:00:00.000Z" },
      { canonical_id: "t1", match_date: "2026-09-12", result_available_at: "2026-09-13T00:00:00.000Z" },
      { canonical_id: "future", match_date: "2026-09-20", result_available_at: "2026-09-21T00:00:00.000Z" },
    ] as unknown as Parameters<typeof priorMatchesAsOf>[0];
    const cut = featureCutoffForMatch({
      match_date: "2026-09-12",
    } as Parameters<typeof featureCutoffForMatch>[0]);
    const priors = priorMatchesAsOf(universe, cut);
    assert.equal(priors.some((m) => m.canonical_id === "t1"), false);
    assert.equal(priors.some((m) => m.canonical_id === "future"), false);
    assert.ok(priors.some((m) => m.canonical_id === "old"));
    assert.doesNotThrow(() =>
      assertNoFutureLeakage({ featureCutoff: cut, usedMatches: priors, targetId: target.canonical_id }),
    );
  });
});

describe("Phase 3F poisson internals", () => {
  it("exposes lambda_home/lambda_away from real feature values", () => {
    const features = {
      values: {
        home_attack_home: 1.6,
        home_defense_home: 1.1,
        away_attack_away: 1.2,
        away_defense_away: 1.4,
        league_avg_gf: 1.4,
      },
      feature_data: [],
      missing_keys: [],
      data_coverage: 1,
      feature_coverage: 1,
      data_quality: 1,
      features_version: "features_pi_v1",
      closing_odds_used: false as const,
    } as unknown as PiFeatureVector;
    const d = predictPoissonIndependentDetailed({ features });
    assert.ok(d.lambda_home > 0);
    assert.ok(d.lambda_away > 0);
    assert.ok(d.probability.HOME > 0);
    assertNoMarketInputsInPredictionContext(Object.keys(features.values));
  });
});