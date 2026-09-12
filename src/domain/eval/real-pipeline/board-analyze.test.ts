import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { NEON_IN_USE } from "@/domain/storage";
import {
  collectCandidatesFromRemote,
  isEligibleBoardEvent,
  selectEligibleBoardEvents,
  type BoardCandidate,
} from "@/domain/eval/real-pipeline/board-select";
import { runBoardAnalysis } from "@/domain/eval/real-pipeline/board-run";
import { publishAnalysis } from "@/domain/eval/real-pipeline/publish";
import {
  createMemoryRemoteMirrorStore,
  findBoardEventInRemoteMirror,
  setRemoteMirrorStoreOverride,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import type { AnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import type { RemoteMirrorArtifact } from "@/domain/eval/betmind-runtime/remote-mirror";
import { liveStateFromOpenLiga, overlayLiveOnBoardRows } from "@/domain/eval/betmind-runtime/live-state";

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
});

function candidate(partial: Partial<BoardCandidate> & Pick<BoardCandidate, "event_id" | "home" | "away">): BoardCandidate {
  return {
    competition: "BL",
    kickoff_utc: "2026-09-13T14:00:00.000Z",
    sport: "soccer",
    status: "UPCOMING",
    origin: "remote_board",
    finished: false,
    live: false,
    ...partial,
  };
}

function sampleDossier(eventId: string, home: string, away: string): AnalysisDossier {
  return {
    event: {
      event_id: eventId,
      home,
      away,
      competition: "Bundesliga",
      kickoff_utc: "2026-09-13T14:00:00.000Z",
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
      probability: null,
      model_version: "INDEPENDENT_POISSON_v1",
      confidence: null,
      feature_coverage: 0.2,
      data_coverage: 0.2,
      decision: "INSUFFICIENT DATA",
      reason_codes: ["INSUFFICIENT_DATA"],
      why: null,
      note: "NO_PREDICTION",
    },
    market: { probability: null, selection_pct: null, note: "market compare only" },
    features: [],
    features_note: null,
    research: [],
    prediction_id: `pred-${eventId}`,
    analyzed_at: "2026-09-12T18:00:00.000Z",
    prediction_persisted_at: "2026-09-12T18:00:00.000Z",
    lineage: {
      what_betmind_knew_before_kickoff: "priors",
      sources_consulted: [],
      catalogue_noted_not_fetched: [],
      source_information: [],
      eligible_information: [],
      features_entered_model: [],
      model_version: "INDEPENDENT_POISSON_v1",
      prediction_produced: "NO_PREDICTION",
      odds_entered_model: false,
      information_missing: ["independent probability"],
      after_inference: "INSUFFICIENT DATA",
      feature_vector_schema: [],
      edge_calculated: false,
      confidence_defined: false,
    },
    real_money: false,
  };
}

function remoteFixture(nowIso: string): RemoteMirrorArtifact {
  return {
    schema: "betmind-remote-mirror/1",
    published_at: nowIso,
    payload: {
      published_at: nowIso,
      components: { brain: "ONLINE" },
      observatory: {
        next_events: [
          {
            event_id: "ev-up-1",
            home_or_a: "Alpha",
            away_or_b: "Beta",
            kickoff_utc: "2026-09-13T14:00:00.000Z",
            status: "UPCOMING",
            bucket: "DISCOVERED",
          },
          {
            event_id: "ev-up-2",
            home_or_a: "Gamma",
            away_or_b: "Delta",
            kickoff_utc: "2026-09-13T16:00:00.000Z",
            status: "UPCOMING",
            bucket: "DISCOVERED",
          },
          {
            event_id: "ev-live-1",
            home_or_a: "St Pauli",
            away_or_b: "Wolfsburg",
            kickoff_utc: "2026-09-12T18:30:00.000Z",
            status: "LIVE",
            bucket: "ANALYZED",
            dossier_present: true,
          },
          {
            event_id: "ev-ft-1",
            home_or_a: "Old",
            away_or_b: "Side",
            kickoff_utc: "2026-09-11T14:00:00.000Z",
            status: "FT",
            finished: true,
            bucket: "DISCOVERED",
          },
        ],
      },
    },
    board_events: [
      {
        event_id: "ev-up-1",
        bucket: "DISCOVERED",
        published_at: nowIso,
        payload: {
          event_id: "ev-up-1",
          home_or_a: "Alpha",
          away_or_b: "Beta",
          kickoff_utc: "2026-09-13T14:00:00.000Z",
          status: "UPCOMING",
        },
      },
      {
        event_id: "ev-up-2",
        bucket: "DISCOVERED",
        published_at: nowIso,
        payload: {
          event_id: "ev-up-2",
          home_or_a: "Gamma",
          away_or_b: "Delta",
          kickoff_utc: "2026-09-13T16:00:00.000Z",
          status: "UPCOMING",
        },
      },
    ],
    dossiers: [],
    neon_in_use: false,
    backend: "memory",
  };
}

describe("analyze:board selection", () => {
  it("never uses Neon", () => {
    assert.equal(NEON_IN_USE, false);
  });

  it("selects multiple upcoming and live events and skips settled FT", () => {
    const nowMs = Date.parse("2026-09-12T19:00:00.000Z");
    const rows = [
      candidate({ event_id: "a", home: "A", away: "B", kickoff_utc: "2026-09-13T14:00:00.000Z" }),
      candidate({ event_id: "b", home: "C", away: "D", kickoff_utc: "2026-09-13T16:00:00.000Z" }),
      candidate({
        event_id: "c",
        home: "E",
        away: "F",
        kickoff_utc: "2026-09-12T18:30:00.000Z",
        status: "LIVE",
        live: true,
      }),
      candidate({
        event_id: "d",
        home: "G",
        away: "H",
        kickoff_utc: "2026-09-11T14:00:00.000Z",
        status: "FT",
        finished: true,
      }),
    ];
    const { selected, skipped_finished } = selectEligibleBoardEvents(rows, { nowMs });
    assert.equal(skipped_finished, 1);
    assert.equal(selected.length, 3);
    assert.deepEqual(
      selected.map((s) => s.event_id),
      ["c", "a", "b"],
    );
    assert.equal(isEligibleBoardEvent(rows[3]!, { nowMs }), false);
    assert.equal(isEligibleBoardEvent(rows[3]!, { nowMs, includeFinished: true }), true);
  });

  it("collects multiple events from a remote board + next_events fixture", () => {
    const art = remoteFixture("2026-09-12T19:00:00.000Z");
    const all = collectCandidatesFromRemote(art);
    const { selected, skipped_finished } = selectEligibleBoardEvents(all, {
      nowMs: Date.parse("2026-09-12T19:00:00.000Z"),
    });
    assert.ok(all.length >= 3);
    assert.equal(skipped_finished, 1);
    assert.ok(selected.length >= 3);
    assert.ok(selected.some((c) => c.event_id === "ev-up-1"));
    assert.ok(selected.some((c) => c.event_id === "ev-up-2"));
    assert.ok(selected.some((c) => c.event_id === "ev-live-1"));
    assert.ok(!selected.some((c) => c.event_id === "ev-ft-1"));
  });

  it("dry-run analyze:board selects multiple remote events without inventing probs", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    await mem.write(remoteFixture("2026-09-12T19:00:00.000Z"));
    const root = mkdtempSync(join(tmpdir(), "bm-board-dry-"));
    const report = await runBoardAnalysis({
      labBRoot: root,
      nowMs: Date.parse("2026-09-12T19:00:00.000Z"),
      dryRun: true,
      includeDiscovery: false,
    });
    assert.equal(report.neon_in_use, false);
    assert.equal(report.dry_run, true);
    assert.ok(report.selected >= 3, `expected ≥3 selected, got ${report.selected}`);
    assert.ok(report.rows.every((r) => r.status === "dry_run"));
    assert.ok(report.rows.every((r) => r.decision == null));
  });
});

describe("analyze:board publish puts ANALYZED board rows", () => {
  it("publishAnalysis writes two events onto remote board_events", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const root = mkdtempSync(join(tmpdir(), "bm-board-pub-"));
    await publishAnalysis({
      eventId: "ev-up-1",
      dossier: sampleDossier("ev-up-1", "Alpha", "Beta"),
      labBRoot: root,
      nowIso: "2026-09-12T19:00:00.000Z",
    });
    await publishAnalysis({
      eventId: "ev-up-2",
      dossier: sampleDossier("ev-up-2", "Gamma", "Delta"),
      labBRoot: root,
      nowIso: "2026-09-12T19:05:00.000Z",
    });
    const art = await mem.read();
    const a = findBoardEventInRemoteMirror(art, "ev-up-1");
    const b = findBoardEventInRemoteMirror(art, "ev-up-2");
    assert.ok(a);
    assert.ok(b);
    assert.equal(a.bucket, "ANALYZED");
    assert.equal(b.bucket, "ANALYZED");
    assert.equal(a.dossier_present, true);
    assert.equal(b.dossier_present, true);
    const next = art?.payload.observatory?.next_events as Array<{ event_id?: string; bucket?: string }>;
    assert.ok(next?.some((e) => e.event_id === "ev-up-1" && e.bucket === "ANALYZED"));
    assert.ok(next?.some((e) => e.event_id === "ev-up-2" && e.bucket === "ANALYZED"));
  });
});

describe("OpenLiga live overlay on board rows", () => {
  it("does not invent a minute and copies a published score", () => {
    const row = liveStateFromOpenLiga(
      "ev-live-1",
      {
        matchIsFinished: false,
        matchDateTimeUTC: "2026-09-12T18:30:00Z",
        team1: { teamName: "St Pauli" },
        team2: { teamName: "Wolfsburg" },
        matchResults: [{ resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 1 }],
      },
      "2026-09-12T19:10:00.000Z",
    );
    assert.equal(row.status, "LIVE");
    assert.equal(row.home_goals, 0);
    assert.equal(row.away_goals, 1);
    assert.equal(row.minute, null);
    assert.equal(row.source, "openligadb");
    assert.equal(row.finished, false);

    const overlaid = overlayLiveOnBoardRows(
      [
        {
          event_id: "ev-live-1",
          bucket: "ANALYZED",
          published_at: "2026-09-12T18:00:00.000Z",
          payload: {
            event_id: "ev-live-1",
            bucket: "ANALYZED",
            status: "UPCOMING",
            home_or_a: "St Pauli",
            away_or_b: "Wolfsburg",
          },
        },
      ],
      [row],
      "2026-09-12T19:10:00.000Z",
    );
    const payload = overlaid[0]!.payload as Record<string, unknown>;
    assert.equal(payload.status, "LIVE");
    assert.equal(payload.home_goals, 0);
    assert.equal(payload.away_goals, 1);
    assert.equal(payload.bucket, "ANALYZED");
  });
});
