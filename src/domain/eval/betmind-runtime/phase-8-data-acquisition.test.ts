import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { namesEqual, normalizeTeamName, resolveCompetitionMatrix } from "@/domain/eval/data-intelligence/research/identity-normalize";
import { resolveTeamIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { resolveApiSportsFixture } from "@/domain/eval/data-intelligence/research/api-sports-fixture";
import { parseUnderstatDatesData, rollingPriorXg } from "@/domain/eval/data-intelligence/research/understat-league";
import { classifyNewsText } from "@/domain/eval/data-intelligence/research/news-classify";
import { computeDataQualityScore } from "@/domain/eval/data-intelligence/research/data-quality";
import { isEligibleForIndependentModel, classifyModelInput } from "@/domain/eval/data-intelligence/research/model-input-policy";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";
import { sourceOnCooldown, markSourceBlocked, clearSourceCooldown } from "@/domain/eval/data-intelligence/research/source-cooldown";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

describe("Phase 8 event intelligence", () => {
  it("runtime is phase-8", () => {
    assert.match(ANALYSIS_RUNTIME_VERSION, /phase-8/);
  });

  it("normalizes aliases without inventing source ids", () => {
    assert.equal(normalizeTeamName("Man Utd"), normalizeTeamName("Manchester United FC"));
    assert.equal(normalizeTeamName("AS Roma"), normalizeTeamName("Roma"));
    assert.equal(normalizeTeamName("Inter Milan"), normalizeTeamName("Internazionale"));
    assert.ok(namesEqual("Bayern Munchen", "Bayern Munich"));
    assert.equal(namesEqual("Villa", "Aston Villa"), false);
    assert.equal(namesEqual("Villa", "Villarreal"), false);
    const a = resolveTeamIdentity("Man Utd");
    const b = resolveTeamIdentity("Manchester United");
    assert.equal(a.canonical_id, b.canonical_id);
    assert.equal(a.source_ids.sofascore, null);
    assert.equal(a.source_ids.understat, null);
  });

  it("maps competitions beyond a single EPL alias", () => {
    assert.equal(resolveCompetitionMatrix("soccer_epl").canonical_code, "E0");
    assert.equal(resolveCompetitionMatrix("England Premier League").canonical_code, "E0");
    assert.equal(resolveCompetitionMatrix("Serie A").canonical_code, "I1");
    assert.equal(resolveCompetitionMatrix("UEFA Champions League").api_sports_league_id, 2);
    assert.equal(resolveCompetitionMatrix("made up cup 2099").canonical_code, null);
  });

  it("resolves API-Sports fixture from injected payload and does not invent ids", async () => {
    const ev = {
      event_id: "test-villa-forest",
      sport: "soccer",
      competition: "soccer_epl",
      home_or_a: "Aston Villa",
      away_or_b: "Nottingham Forest",
      kickoff_utc: "2026-09-13T14:00:00.000Z",
    } as PermanentEvent044;
    const body = {
      response: [
        {
          fixture: { id: 1234567, date: "2026-09-13T14:00:00+00:00", referee: "Michael Oliver", venue: { name: "Villa Park" } },
          league: { id: 39, name: "Premier League", season: 2026 },
          teams: { home: { id: 66, name: "Aston Villa" }, away: { id: 65, name: "Nottingham Forest" } },
        },
      ],
    };
    const hit = await resolveApiSportsFixture({
      event: ev,
      labBRoot: "artifacts/phase-8-test-identity",
      nowIso: "2026-09-11T08:00:00.000Z",
      deps: { fixturesBody: body, skipNetwork: true },
    });
    assert.ok(hit.status === "RESOLVED" || hit.status === "CACHED");
    assert.equal(hit.fixture_id, 1234567);
    if (hit.status === "RESOLVED") assert.equal(hit.referee, "Michael Oliver");

    const miss = await resolveApiSportsFixture({
      event: { ...ev, event_id: "test-other", home_or_a: "Como", away_or_b: "RB Leipzig" },
      labBRoot: "artifacts/phase-8-test-identity",
      nowIso: "2026-09-11T08:00:00.000Z",
      deps: { fixturesBody: body, skipNetwork: true },
    });
    assert.equal(miss.fixture_id, null);
    assert.equal(miss.status, "NO_EVENT");
  });

  it("uses only prior Understat xG and excludes the target match", () => {
    const html = `<script>var datesData = JSON.parse('[{"id":"1","isResult":true,"datetime":"2026-09-01 15:00:00","h":{"title":"Aston Villa"},"a":{"title":"Bournemouth"},"xG":{"h":"1.8","a":"0.9"}},{"id":"9","isResult":false,"datetime":"2026-09-13 15:00:00","h":{"title":"Aston Villa"},"a":{"title":"Nottingham Forest"},"xG":{"h":"9.9","a":"9.9"}}]')</script>`;
    const matches = parseUnderstatDatesData(html);
    assert.equal(matches.length, 2);
    const roll = rollingPriorXg({
      matches,
      home: "Aston Villa",
      away: "Nottingham Forest",
      kickoffIso: "2026-09-13T14:00:00.000Z",
    });
    assert.equal(roll.target?.id, "9");
    assert.equal(roll.home_xg_l5, 1.8);
    assert.notEqual(roll.home_xg_l5, 9.9);
  });

  it("classifies news without turning it into a model input", () => {
    assert.equal(classifyNewsText("Aston Villa, infortunio per il terzino"), "INJURY");
    assert.equal(classifyNewsText("Formazione ufficiale"), "LINEUP");
    assert.equal(isEligibleForIndependentModel(classifyModelInput({ kind: "MARKET", source: "the-odds-api" })), false);
  });

  it("odds never enter independent context", () => {
    assert.throws(() => assertNoMarketInputsInPredictionContext(["odds_home", "home_gf_l5"]));
    assert.doesNotThrow(() => assertNoMarketInputsInPredictionContext(["home_gf_l5", "away_gf_l5"]));
  });

  it("keeps model gates unchanged", () => {
    const text = readFileSync("src/domain/eval/predictive-intelligence/predict-live.ts", "utf8");
    assert.match(text, /missing_keys\.length > 45/);
    assert.match(text, /feature_coverage < 0\.35/);
  });

  it("403 cooldown does not block other sources", () => {
    clearSourceCooldown();
    markSourceBlocked("sofascore", 403, 1_000);
    assert.equal(sourceOnCooldown("sofascore", 2_000), true);
    assert.equal(sourceOnCooldown("understat", 2_000), false);
    clearSourceCooldown();
  });

  it("data quality letter is not model confidence", () => {
    const q = computeDataQualityScore({
      real_features: 40,
      derived_features: 10,
      historical_prior_features: 20,
      missing_features: 5,
      sources_success: 4,
      sources_partial: 1,
      sources_blocked: 0,
      independent_sources: 4,
      conflicts: 0,
      temporal_exclusions: 0,
    });
    assert.ok(["A", "B", "C", "D", "F"].includes(q.letter));
    assert.match(q.note_it, /Non sostituisce i gate/);
  });
});
