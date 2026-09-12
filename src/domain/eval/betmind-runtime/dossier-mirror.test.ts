import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { getStorage, NEON_IN_USE } from "@/domain/storage";
import {
  createMemoryRemoteMirrorStore,
  findDossierInRemoteMirror,
  isRealAnalysisDossier,
  setRemoteMirrorStoreOverride,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import {
  persistAndMirrorDossier,
  repairMirror,
  validateAnalysisDossier,
} from "@/domain/eval/betmind-runtime/dossier-mirror";
import type { AnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
});

function sampleDossier(eventId: string): AnalysisDossier {
  return {
    event: {
      event_id: eventId,
      home: "Alpha",
      away: "Beta",
      competition: "Bundesliga",
      kickoff_utc: "2026-09-12T14:30:00.000Z",
      sport: "soccer",
      status: "UPCOMING",
    },
    cycle: {
      cycle_number: 1,
      last_cycle_at: "2026-09-12T10:00:00.000Z",
      last_successful_cycle_at: "2026-09-12T10:00:00.000Z",
      model_version: "NO_INDEPENDENT",
    },
    independent_model: {
      probability: null,
      model_version: null,
      confidence: null,
      feature_coverage: 0.1,
      data_coverage: 0.1,
      decision: "NO_BET",
      reason_codes: ["INSUFFICIENT_DATA"],
      why: null,
      note: "NO DATA AVAILABLE",
    },
    market: { probability: null, selection_pct: null, note: "market compare only" },
    features: [
      {
        name: "home_gf_l5",
        value: null,
        source: "unavailable",
        observed_at: null,
        available_at: null,
        status: "UNAVAILABLE",
        entered_model: false,
      },
    ],
    features_note: "NO DATA AVAILABLE",
    research: [],
    prediction_id: null,
    analyzed_at: null,
    prediction_persisted_at: null,
    lineage: {
      what_betmind_knew_before_kickoff: "No independent model",
      sources_consulted: [],
      catalogue_noted_not_fetched: [],
      source_information: [],
      eligible_information: [],
      features_entered_model: [],
      model_version: null,
      prediction_produced: "NO_PREDICTION_ROW",
      odds_entered_model: false,
      information_missing: ["independent probability_model"],
      after_inference: "No independent inference",
      feature_vector_schema: [],
      edge_calculated: false,
      confidence_defined: false,
    },
    real_money: false,
  };
}

describe("analysis_dossier is not a board_summary", () => {
  it("rejects board lite fields as a dossier", () => {
    assert.equal(
      isRealAnalysisDossier({
        event_id: "ev-1",
        bucket: "DISCOVERED",
        label: "Alpha vs Beta",
        decision: "NO_BET",
      }),
      false,
    );
    const v = validateAnalysisDossier({ event_id: "ev-1", bucket: "ANALYZED" });
    assert.equal(v.ok, false);
  });

  it("accepts a real analysis_dossier with null independent probability", () => {
    const d = sampleDossier("ev-gold-1");
    assert.equal(isRealAnalysisDossier(d), true);
    const v = validateAnalysisDossier(d);
    assert.equal(v.ok, true);
    if (v.ok) assert.equal(v.event_id, "ev-gold-1");
  });

  it("rejects naked probability without independent model version", () => {
    const d = sampleDossier("ev-naked");
    d.independent_model.probability = { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 };
    d.independent_model.model_version = "market-guess";
    const v = validateAnalysisDossier(d);
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.reason, "naked_probability_without_independent_model");
  });
});

describe("repairMirror local YES remote NO", () => {
  it("mirrors a local dossier onto the remote artifact and verifies readback", async () => {
    assert.equal(NEON_IN_USE, false);
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-dmir-"));
    const store = getStorage(root);
    store.upsertDossier("ev-gold-1", sampleDossier("ev-gold-1"));
    assert.ok(store.loadDossier("ev-gold-1"));
    assert.equal(findDossierInRemoteMirror(await mem.read(), "ev-gold-1"), null);

    const repaired = await repairMirror("ev-gold-1", root);
    assert.equal(repaired.local, true);
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.remote_readable, true);
    const remote = findDossierInRemoteMirror(await mem.read(), "ev-gold-1");
    assert.ok(remote);
    assert.equal((remote.event as { event_id: string }).event_id, "ev-gold-1");
    assert.ok(Array.isArray(remote.features));
  });

  it("does not invent a remote dossier when local is missing", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-dmir-miss-"));
    const repaired = await repairMirror("ev-absent", root);
    assert.equal(repaired.repaired, false);
    assert.equal(repaired.reason, "local_dossier_missing");
    assert.equal(await mem.read(), null);
  });
});

describe("persistAndMirrorDossier", () => {
  it("verifies local persist then remote read for a provided dossier", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-persist-"));
    const result = await persistAndMirrorDossier("ev-gold-2", root, sampleDossier("ev-gold-2"));
    assert.equal(result.local_persisted, true);
    assert.equal(result.local_verified, true);
    assert.equal(result.remote_verified, true);
    assert.equal(NEON_IN_USE, false);
  });
});
