/**
 * Phase 3E — live resolve + independent inference must produce non-null probs
 * for resolvable EPL teams without odds in the feature bag.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapCompetitionToPiDivision,
  resolveLiveTeamId,
  resolveLivePiTarget,
} from "@/domain/eval/predictive-intelligence/live-resolve";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { predictIndependentForEvent } from "@/domain/eval/predictive-intelligence/predict-live";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";

describe("Phase 3E live resolve", () => {
  it("maps soccer_epl → E0 and Nottingham Forest → nottingham-forest", () => {
    assert.equal(mapCompetitionToPiDivision("soccer_epl"), "E0");
    const matches = loadPiMatches();
    if (matches.length < 500) return; // skip if dataset absent in CI
    const forest = resolveLiveTeamId("Nottingham Forest", matches);
    assert.equal(forest.team_id, "nottingham-forest");
    assert.equal(forest.matched, true);
    const villa = resolveLiveTeamId("Aston Villa", matches);
    assert.equal(villa.team_id, "aston-villa");
    const meta = resolveLivePiTarget({
      home_team: "Aston Villa",
      away_team: "Nottingham Forest",
      competition: "soccer_epl",
      matches,
    });
    assert.equal(meta.division, "E0");
    assert.notEqual(meta.season, "live");
  });
});

describe("Phase 3E independent inference", () => {
  it("produces non-null probability_model for Villa vs Forest without odds keys", () => {
    const matches = loadPiMatches();
    if (matches.length < 500) return;
    const r = predictIndependentForEvent({
      sport: "soccer",
      home_team: "Aston Villa",
      away_team: "Nottingham Forest",
      competition: "soccer_epl",
      kickoff_utc: "2026-09-12T14:00:00Z",
      marketProbability: { HOME: 0.9, DRAW: 0.05, AWAY: 0.05 }, // must NOT enter model
    });
    assert.equal(r.ok, true, `expected ok, got ${r.reason_codes.join(",")}`);
    assert.ok(r.probability_model);
    assert.ok(typeof r.probability_model!.HOME === "number");
    assert.ok(typeof r.probability_model!.DRAW === "number");
    assert.ok(typeof r.probability_model!.AWAY === "number");
    const sum =
      r.probability_model!.HOME + r.probability_model!.DRAW + r.probability_model!.AWAY;
    assert.ok(Math.abs(sum - 1) < 1e-6);
    assert.ok((r.feature_coverage ?? 0) >= 0.35);
    assert.ok(r.reason_codes.includes("INDEPENDENT_MODEL"));
    assert.ok(r.reason_codes.includes("PI_UNIVERSE_RESOLVED"));
    assert.equal(r.closing_odds_used, false);
    assertNoMarketInputsInPredictionContext(Object.keys(r.feature_snapshot ?? {}));
    // Market mirror flag may appear but probs must not equal market copy trivially required —
    // Poisson output should differ from extreme 0.9/0.05/0.05 unless coincidence
    assert.ok(r.probability_model!.HOME < 0.85 || r.probability_model!.AWAY > 0.1);
  });
});
