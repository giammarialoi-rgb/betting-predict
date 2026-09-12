/**
 * After publishAnalysis, the remote artifact must list the event on
 * board_events AND observatory.next_events. Never synthesize a dossier.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { publishAnalysis } from "@/domain/eval/real-pipeline/publish";
import { listAnalyzedEvents } from "@/domain/eval/light-analysis/list";
import { overlayAnalyzedDossiersOntoEvents } from "@/domain/eval/betmind-runtime/remote-mirror";
import {
  createMemoryRemoteMirrorStore,
  findBoardEventInRemoteMirror,
  findDossierInRemoteMirror,
  setRemoteMirrorStoreOverride,
  writeRemoteMirror,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import { NEON_IN_USE } from "@/domain/storage";
import type { AnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
});

const EVENT_ID = "719d874c61e33ab20d7f730f";

function sampleDossier(eventId: string): AnalysisDossier {
  return {
    event: {
      event_id: eventId,
      home: "FC St. Pauli",
      away: "VfL Wolfsburg",
      competition: "Bundesliga",
      kickoff_utc: "2026-09-13T13:30:00.000Z",
      sport: "soccer",
      status: "UPCOMING",
    },
    cycle: {
      cycle_number: 1,
      last_cycle_at: "2026-09-12T18:00:00.000Z",
      last_successful_cycle_at: "2026-09-12T18:00:00.000Z",
      model_version: "INDEPENDENT_POISSON_v1",
    },
    independent_model: {
      probability: { HOME: 0.34, DRAW: 0.28, AWAY: 0.38 },
      model_version: "INDEPENDENT_POISSON_v1",
      confidence: 0.4,
      feature_coverage: 0.5,
      data_coverage: 0.5,
      decision: "NO BET",
      reason_codes: ["EDGE_BELOW_THRESHOLD"],
      why: null,
      note: "Independent Poisson — paper only",
    },
    market: { probability: null, selection_pct: null, note: "market compare only" },
    features: [
      {
        name: "home_gf_l5",
        value: 1.2,
        source: "football-data-co-uk",
        observed_at: "2026-09-12T12:00:00.000Z",
        available_at: "2026-09-12T12:00:00.000Z",
        status: "OK",
        entered_model: true,
      },
    ],
    features_note: null,
    research: [],
    prediction_id: "pred-stpauli-1",
    analyzed_at: "2026-09-12T18:00:00.000Z",
    prediction_persisted_at: "2026-09-12T18:00:00.000Z",
    lineage: {
      what_betmind_knew_before_kickoff: "Independent Poisson priors",
      sources_consulted: ["football-data-co-uk"],
      catalogue_noted_not_fetched: [],
      source_information: [],
      eligible_information: [],
      features_entered_model: ["home_gf_l5"],
      model_version: "INDEPENDENT_POISSON_v1",
      prediction_produced: "PREDICTION",
      odds_entered_model: false,
      information_missing: [],
      after_inference: "NO BET",
      feature_vector_schema: [],
      edge_calculated: true,
      confidence_defined: true,
    },
    real_money: false,
  };
}

describe("publishAnalysis mirrors ANALYZED onto remote board + next_events", () => {
  it("writes event_id into board_events and observatory.next_events on memory store", async () => {
    assert.equal(NEON_IN_USE, false);
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-pub-board-"));
    const published = await publishAnalysis({
      eventId: EVENT_ID,
      dossier: sampleDossier(EVENT_ID),
      labBRoot: root,
      nowIso: "2026-09-12T19:00:00.000Z",
    });
    assert.equal(published.local_verified, true);
    assert.equal(published.remote_verified, true);
    assert.equal(published.remote_board, "OK");
    assert.equal(published.backend, "memory");

    const art = await mem.read();
    assert.ok(art);
    assert.equal(findDossierInRemoteMirror(art, EVENT_ID) != null, true);
    const board = findBoardEventInRemoteMirror(art, EVENT_ID);
    assert.ok(board);
    assert.equal(board.bucket, "ANALYZED");
    assert.equal(board.dossier_present, true);
    assert.equal(board.label, "FC St. Pauli vs VfL Wolfsburg");
    assert.equal(board.model_version, "INDEPENDENT_POISSON_v1");
    assert.ok(art.board_events.some((r) => r.event_id === EVENT_ID && r.bucket === "ANALYZED"));
    const next = art.payload.observatory?.next_events as Array<{
      event_id?: string;
      bucket?: string;
      dossier_present?: boolean;
    }>;
    assert.ok(next?.some((e) => e.event_id === EVENT_ID && e.bucket === "ANALYZED"));
  });

  it("does not wipe a prior dossier when publishing a second event", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-pub-keep-"));
    await publishAnalysis({
      eventId: "ev-keep",
      dossier: sampleDossier("ev-keep"),
      labBRoot: root,
      nowIso: "2026-09-12T19:00:00.000Z",
    });
    await publishAnalysis({
      eventId: EVENT_ID,
      dossier: sampleDossier(EVENT_ID),
      labBRoot: root,
      nowIso: "2026-09-12T19:05:00.000Z",
    });
    const art = await mem.read();
    assert.ok(findDossierInRemoteMirror(art, "ev-keep"));
    assert.ok(findDossierInRemoteMirror(art, EVENT_ID));
    assert.ok(findBoardEventInRemoteMirror(art, "ev-keep"));
    assert.ok(findBoardEventInRemoteMirror(art, EVENT_ID));
  });

  it("keeps ANALYZED on board+next after a DISCOVERED board-only rewrite", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-pub-preserve-"));
    await publishAnalysis({
      eventId: EVENT_ID,
      dossier: sampleDossier(EVENT_ID),
      labBRoot: root,
      nowIso: "2026-09-12T19:00:00.000Z",
    });
    const rewritten = await writeRemoteMirror(
      {
        published_at: "2026-09-12T20:00:00.000Z",
        components: { brain: "ONLINE" },
        observatory: {
          next_events: [
            {
              event_id: "ev-other",
              bucket: "DISCOVERED",
              label: "Other vs Side",
              kickoff_utc: "2026-09-13T15:00:00.000Z",
            },
          ],
        },
      },
      [
        {
          event_id: "ev-other",
          bucket: "DISCOVERED",
          published_at: "2026-09-12T20:00:00.000Z",
          payload: { event_id: "ev-other", bucket: "DISCOVERED" },
        },
      ],
      [],
    );
    assert.equal(rewritten.ok, true);
    const art = await mem.read();
    assert.ok(findDossierInRemoteMirror(art, EVENT_ID));
    const board = findBoardEventInRemoteMirror(art, EVENT_ID);
    assert.ok(board);
    assert.equal(board.bucket, "ANALYZED");
    const next = art?.payload.observatory?.next_events as Array<{ event_id?: string; bucket?: string }>;
    assert.ok(next?.some((e) => e.event_id === EVENT_ID && e.bucket === "ANALYZED"));
    assert.ok(next?.some((e) => e.event_id === "ev-other"));
  });
});

describe("listAnalyzedEvents reads remote dossiers without local FS", () => {
  it("lists a Blob/memory dossier even when Lab B events.jsonl is absent", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-list-remote-"));
    await publishAnalysis({
      eventId: EVENT_ID,
      dossier: sampleDossier(EVENT_ID),
      labBRoot: root,
      nowIso: "2026-09-12T19:00:00.000Z",
    });
    const rows = await listAnalyzedEvents(root);
    const hit = rows.find((r) => r.event_id === EVENT_ID);
    assert.ok(hit);
    assert.equal(hit.home, "FC St. Pauli");
    assert.equal(hit.away, "VfL Wolfsburg");
    assert.equal(hit.strong, true);
  });

  it("Eventi overlay surfaces ANALYZED from remote dossiers without inventing one", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-overlay-"));
    await publishAnalysis({
      eventId: EVENT_ID,
      dossier: sampleDossier(EVENT_ID),
      labBRoot: root,
      nowIso: "2026-09-12T19:00:00.000Z",
    });
    const art = await mem.read();
    const overlaid = overlayAnalyzedDossiersOntoEvents(
      [{ event_id: "ev-cal", bucket: "DISCOVERED", label: "Cal vs Endar" }],
      art,
    ) as Array<{ event_id?: string; bucket?: string }>;
    assert.ok(overlaid.some((e) => e.event_id === "ev-cal" && e.bucket === "DISCOVERED"));
    assert.ok(overlaid.some((e) => e.event_id === EVENT_ID && e.bucket === "ANALYZED"));
  });
});
