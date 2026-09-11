import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFeatureObservationIdentityKey } from "@/domain/eval/identity-keys";
import { RESEARCH_SOURCE_CATALOGUE, catalogueAdapterKind } from "@/domain/eval/data-intelligence/research/source-catalogue";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import {
  isUnderstatXgObservation,
  researchObservationsFromDossierFeatures,
  understatXgPersistRows,
  UNDERSTAT_DATA_SOURCE_SLUG,
  publishUnderstatXgObservations,
} from "@/ingest/understat-feature-publish";

function obs(partial: Partial<ResearchObservation> & Pick<ResearchObservation, "feature_key" | "value">): ResearchObservation {
  return {
    event_id: "labb-event-1",
    source: "understat",
    source_url: "https://understat.com/getLeagueData/EPL/2026",
    observed_at: "2026-09-11T08:00:00.000Z",
    available_at: null,
    extraction_method: "understat_getLeagueData_prior_only",
    confidence: null,
    status: "REAL",
    kind: "HISTORICAL_PRIOR",
    derived_from: ["understat_getLeagueData", "excluded_target=true"],
    enters_independent_model: false,
    source_event_id: "99",
    target_event_id: "labb-event-1",
    ...partial,
  };
}

describe("Understat feature_observations publish mapping", () => {
  it("registers Understat as a production adapter, not a probe or mock", () => {
    const row = RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === "understat");
    assert.equal(row?.adapter, "PRODUCTION_ADAPTER");
    assert.equal(catalogueAdapterKind("understat"), "PRODUCTION_ADAPTER");
    assert.equal(UNDERSTAT_DATA_SOURCE_SLUG, "understat");
    assert.equal(row?.market_layer, false);
  });

  it("maps real numeric xG keys to NOT_ELIGIBLE / CONTEXT with available_at null", () => {
    const rows = understatXgPersistRows([
      obs({ feature_key: "home_xg_l5", value: 1.584 }),
      obs({ feature_key: "away_xg_prematch", value: 1.776 }),
      obs({ feature_key: "home_xga_l5", value: 1.2 }),
    ]);
    assert.equal(rows.length, 3);
    for (const r of rows) {
      assert.equal(r.featureStatus, "NOT_ELIGIBLE");
      assert.equal(r.temporalPrecision, "unknown");
      assert.equal(r.availableAt, null);
      assert.equal(r.featureValueJson.enters_independent_model, false);
      assert.equal(r.featureValueJson.eligibility, "NOT_ELIGIBLE");
      assert.equal(r.featureValueJson.context_status, "CONTEXT");
      assert.equal(r.featureValueJson.lab_b_event_id, "labb-event-1");
      assert.ok(typeof r.featureValueNumeric === "number" && Number.isFinite(r.featureValueNumeric));
    }
    assert.equal(rows[0]!.featureValueNumeric, 1.584);
  });

  it("omits missing xG and does not coerce null to zero; keeps a real extracted zero", () => {
    const rows = understatXgPersistRows([
      obs({ feature_key: "home_xg_l5", value: null }),
      obs({ feature_key: "away_xg_l5", value: 0 }),
      obs({ feature_key: "form_5_overall", value: 7 }),
      obs({ feature_key: "home_xg_prematch", value: 1.5, source: "fbref" }),
      obs({ feature_key: "odds_home", value: 1.9, source: "the-odds-api" }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.featureKey, "away_xg_l5");
    assert.equal(rows[0]!.featureValueNumeric, 0);
    assert.equal(isUnderstatXgObservation(obs({ feature_key: "home_xg_l5", value: null })), false);
    assert.equal(isUnderstatXgObservation(obs({ feature_key: "home_xg_l5", value: 1.1 })), true);
  });

  it("builds identity keys with empty available_at when the clock is unknown", () => {
    const key = buildFeatureObservationIdentityKey({
      eventId: "evt",
      featureKey: "home_xg_l5",
      availableAt: null,
      featureStatus: "NOT_ELIGIBLE",
      valueFingerprint: "1.584#######",
    });
    assert.equal(key, "evt|home_xg_l5||NOT_ELIGIBLE|1.584#######");
    assert.doesNotMatch(key, /1970-01-01/);
  });

  it("reconstructs persistable observations from a dossier feature bag without inventing values", () => {
    const mapped = researchObservationsFromDossierFeatures({
      eventId: "e1",
      observedAtFallback: "2026-09-11T08:00:00.000Z",
      sourceUrl: "https://understat.com/getLeagueData/Serie_A/2026",
      features: [
        {
          name: "away_xg_prematch",
          value: 1.584,
          source: "understat",
          observed_at: "2026-09-11T07:00:00.000Z",
          available_at: null,
          derived_from: ["understat_getLeagueData"],
        },
        { name: "away_xg_prematch", value: null, source: "understat", available_at: null },
        { name: "home_gf_l5", value: 1.2, source: "football-data-co-uk" },
      ],
    });
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0]!.value, 1.584);
    assert.equal(mapped[0]!.available_at, null);
    assert.equal(mapped[0]!.enters_independent_model, false);
  });

  it("no-ops the Neon write when DATABASE_URL is unset", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const result = await publishUnderstatXgObservations({
        observations: [obs({ feature_key: "home_xg_l5", value: 1.2 })],
        event: {
          event_id: "e1",
          home: "Aston Villa",
          away: "Nottingham Forest",
          competition: "soccer_epl",
          kickoff_utc: "2026-09-13T14:00:00.000Z",
        },
      });
      assert.equal(result.attempted, false);
      assert.equal(result.stored, 0);
      assert.match(String(result.reason), /DATABASE_URL/);
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev;
    }
  });
});
