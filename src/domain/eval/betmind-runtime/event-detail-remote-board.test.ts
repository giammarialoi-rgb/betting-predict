import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  EVENT_DETAIL_DOSSIER_NOT_MIRRORED_IT,
  EVENT_DETAIL_NOT_FOUND_IT,
  GET,
} from "@/app/api/betmind/event/[id]/route";
import { loadBoardEventStore } from "@/domain/eval/betmind-runtime/dossier";
import {
  createMemoryRemoteMirrorStore,
  findBoardEventInRemoteMirror,
  findLightAnalysisInRemoteMirror,
  setRemoteMirrorStoreOverride,
  writeRemoteMirror,
  type RuntimeIngestPayload,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import type { BoardEventMirrorRow } from "@/domain/storage/types";
import { loadLightAnalysis } from "@/domain/eval/light-analysis/persist";

const EVENT_ID = "ev-remote-1";
const MISSING_ID = "ev-absent";

const lightAnalysis = {
  event_id: EVENT_ID,
  home: "Alpha",
  away: "Beta",
  competition: "Serie A",
  kickoff_utc: "2026-09-12T18:00:00Z",
  sport: "FOOTBALL",
  status: "SCHEDULED",
  score_home: null,
  score_away: null,
  analyzed_at: "2026-09-12T10:00:00.000Z",
  mode: "light",
  mode_label_it: "Light",
  sources_used: ["football-data-co-uk"],
  attach: [],
  markets: [
    {
      market: "1x2",
      line: null,
      selection: "HOME",
      label_it: "1 (casa)",
      probability: 0.42,
      n: 8,
      status: "OK",
      insufficient_it: null,
      source_ids: ["football-data-co-uk"],
      method: "empirical_frequency",
      enters_strong_model: false,
    },
  ],
  favorite_1x2: "home",
  prose: ["Lean casa da frequenze storiche."],
  history_n: { home_home: 8, away_away: 8, team_any: 16, corners: 0 },
  identity_fail_closed: true,
  odds_entered_model: false,
  strong_available: false,
  strong_unavailable_it: "Forte non disponibile.",
  light_match: "alias",
};

function samplePayload(publishedAt: string): RuntimeIngestPayload {
  return {
    published_at: publishedAt,
    components: { brain: "ONLINE" },
    observatory: {
      next_events: [
        {
          event_id: EVENT_ID,
          sport: "FOOTBALL",
          calendar_day: "2026-09-12",
          kickoff_utc: "2026-09-12T18:00:00Z",
          bucket: "DISCOVERED",
          label: "Alpha vs Beta",
          competition: "Serie A",
        },
      ],
    },
    store_present_local: true,
    host: "lab-b-pc",
  };
}

function boardRow(): BoardEventMirrorRow {
  return {
    event_id: EVENT_ID,
    bucket: "DISCOVERED",
    published_at: "2026-09-12T10:00:00.000Z",
    payload: {
      event_id: EVENT_ID,
      sport: "FOOTBALL",
      calendar_day: "2026-09-12",
      kickoff_utc: "2026-09-12T18:00:00Z",
      bucket: "DISCOVERED",
      label: "Alpha vs Beta",
      competition: "Serie A",
      decision: "NO_BET",
      prediction_status: "INSUFFICIENT_DATA",
    },
  };
}

async function withVercelLike<T>(fn: () => Promise<T>): Promise<T> {
  const prevCwd = process.cwd();
  const cwd = mkdtempSync(join(tmpdir(), "bm-vercel-detail-"));
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prevCwd);
  }
}

async function detail(id: string) {
  return GET(new Request(`http://localhost/api/betmind/event/${id}`), {
    params: Promise.resolve({ id }),
  });
}

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
});

describe("remote board lookup (same sources as Eventi list)", () => {
  it("finds an id in Blob board_events and not in a missing-id case", () => {
    const remote = {
      schema: "betmind-remote-mirror/1" as const,
      published_at: "2026-09-12T10:00:00.000Z",
      payload: samplePayload("2026-09-12T10:00:00.000Z"),
      board_events: [boardRow()],
      neon_in_use: false as const,
      backend: "memory" as const,
    };
    const hit = findBoardEventInRemoteMirror(remote, EVENT_ID);
    assert.equal(hit?.event_id, EVENT_ID);
    assert.equal(hit?.label, "Alpha vs Beta");
    assert.equal(findBoardEventInRemoteMirror(remote, MISSING_ID), null);
    assert.equal(findLightAnalysisInRemoteMirror(remote, EVENT_ID), null);
  });

  it("surfaces a light analysis already on the remote mirror — never from board lite fields", () => {
    const remote = {
      schema: "betmind-remote-mirror/1" as const,
      published_at: "2026-09-12T10:00:00.000Z",
      payload: {
        ...samplePayload("2026-09-12T10:00:00.000Z"),
        light_analyses: [lightAnalysis],
      },
      board_events: [boardRow()],
      neon_in_use: false as const,
      backend: "memory" as const,
    };
    const hit = findLightAnalysisInRemoteMirror(remote, EVENT_ID);
    assert.equal(hit?.event_id, EVENT_ID);
    assert.equal(hit?.mode, "light");
    assert.ok(Array.isArray(hit?.markets));
    assert.equal(findLightAnalysisInRemoteMirror(remote, MISSING_ID), null);
  });
});

describe("Vercel-like event detail (no Lab B disk)", () => {
  it("does not claim board missing when the remote mirror has the id", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    await writeRemoteMirror(samplePayload("2026-09-12T10:00:00.000Z"), [boardRow()]);

    await withVercelLike(async () => {
      const board = await loadBoardEventStore(EVENT_ID);
      assert.equal(board?.event_id, EVENT_ID);
      assert.equal(board?.label, "Alpha vs Beta");

      const res = await detail(EVENT_ID);
      assert.equal(res.status, 404);
      const json = (await res.json()) as {
        error: string;
        reason: string;
        present: { board_event: boolean; analysis_dossier: boolean; lab_b_disk: boolean };
        board_summary?: { event_id?: string; label?: string };
      };
      assert.equal(json.error, "dossier_not_mirrored");
      assert.equal(json.present.board_event, true);
      assert.equal(json.present.analysis_dossier, false);
      assert.equal(json.present.lab_b_disk, false);
      assert.equal(json.board_summary?.event_id, EVENT_ID);
      assert.equal(json.board_summary?.label, "Alpha vs Beta");
      assert.equal(json.reason, EVENT_DETAIL_DOSSIER_NOT_MIRRORED_IT);
      assert.doesNotMatch(json.reason, /Neon/i);
    });
  });

  it("returns full not_found only when the id is absent from the remote board too", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    await writeRemoteMirror(samplePayload("2026-09-12T10:00:00.000Z"), [boardRow()]);

    await withVercelLike(async () => {
      assert.equal(await loadBoardEventStore(MISSING_ID), null);
      const res = await detail(MISSING_ID);
      assert.equal(res.status, 404);
      const json = (await res.json()) as {
        error: string;
        reason: string;
        present: { board_event: boolean };
        missing: string[];
      };
      assert.equal(json.error, "not_found");
      assert.equal(json.present.board_event, false);
      assert.equal(json.reason, EVENT_DETAIL_NOT_FOUND_IT);
      assert.doesNotMatch(json.reason, /Neon/i);
      assert.match(json.reason, /filesystem\/specchio remoto/);
      assert.ok(!json.missing.includes("betmind_board_events"));
    });
  });

  it("surfaces remote-mirror light analysis without inventing a dossier", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const payload = {
      ...samplePayload("2026-09-12T10:00:00.000Z"),
      light_analyses: [lightAnalysis],
    };
    await writeRemoteMirror(payload, [boardRow()]);

    await withVercelLike(async () => {
      const light = await loadLightAnalysis(EVENT_ID);
      assert.equal(light?.event_id, EVENT_ID);
      assert.equal(light?.mode, "light");

      const res = await detail(EVENT_ID);
      assert.equal(res.status, 200);
      const json = (await res.json()) as {
        dossier: unknown;
        light_analysis: { event_id: string; mode: string } | null;
        mirror_source: string;
      };
      assert.equal(json.dossier, null);
      assert.equal(json.light_analysis?.event_id, EVENT_ID);
      assert.equal(json.light_analysis?.mode, "light");
      assert.equal(json.mirror_source, "filesystem_board_light");
    });
  });
});
