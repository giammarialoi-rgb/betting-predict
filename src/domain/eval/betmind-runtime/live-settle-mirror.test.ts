import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import {
  classifyEspnLiveStatus,
  ingestLiveStates,
  liveStateFromEspn,
  overlayLiveOnEvents,
  parsePublishedScorePair,
} from "@/domain/eval/betmind-runtime/live-state";
import { settleFromLiveState } from "@/domain/eval/betmind-runtime/settle-learn";
import {
  acceptRuntimeIngest,
  createMemoryRemoteMirrorStore,
  findLearningInRemoteMirror,
  findLiveInRemoteMirror,
  findSettlementInRemoteMirror,
  mergeByEventId,
  remoteFreshness,
  remoteMirrorActivityAt,
  setRemoteMirrorStoreOverride,
  writeRemoteMirror,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import { GET } from "@/app/api/betmind/event/[id]/route";
import { getStorage } from "@/domain/storage";

const ESPN_LIVE = JSON.stringify({
  events: [
    {
      id: "401879285",
      date: "2026-09-12T14:00Z",
      name: "Brentford at AFC Bournemouth",
      competitions: [
        {
          competitors: [
            { homeAway: "home", score: "0", team: { displayName: "AFC Bournemouth" } },
            { homeAway: "away", score: "1", team: { displayName: "Brentford" } },
          ],
          status: {
            displayClock: "37'",
            period: 1,
            type: {
              name: "STATUS_FIRST_HALF",
              state: "in",
              completed: false,
              shortDetail: "37'",
            },
          },
        },
      ],
    },
  ],
});

const ESPN_FT = JSON.stringify({
  events: [
    {
      id: "401879285",
      date: "2026-09-12T14:00Z",
      name: "Brentford at AFC Bournemouth",
      competitions: [
        {
          competitors: [
            { homeAway: "home", score: "1", team: { displayName: "AFC Bournemouth" } },
            { homeAway: "away", score: "2", team: { displayName: "Brentford" } },
          ],
          status: {
            displayClock: "90'",
            period: 2,
            type: {
              name: "STATUS_FINAL",
              state: "post",
              completed: true,
              shortDetail: "FT",
            },
          },
        },
      ],
    },
  ],
});

function samplePayload(publishedAt: string) {
  return {
    published_at: publishedAt,
    components: { brain: "ONLINE" },
    observatory: {
      next_events: [
        {
          event_id: "de3b08b74a8249c647ee0e42",
          label: "AFC Bournemouth vs Brentford",
          home_or_a: "AFC Bournemouth",
          away_or_b: "Brentford",
          status: "UPCOMING",
        },
      ],
    },
    recent_settlements: [],
    learning_cases: [],
  };
}

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
});

describe("ESPN live score parse — no invented numbers", () => {
  it("parses Lab score strings without inventing digits", () => {
    assert.deepEqual(parsePublishedScorePair("0-1"), { home: 0, away: 1 });
    assert.deepEqual(parsePublishedScorePair("1–1"), { home: 1, away: 1 });
    assert.equal(parsePublishedScorePair("n/a"), null);
    assert.equal(parsePublishedScorePair(""), null);
  });

  it("extracts score, clock, and in-play status from a real scoreboard shape", () => {
    const ev = parseEspnScoreboard(ESPN_LIVE, "eng.1")[0];
    assert.ok(ev);
    assert.equal(ev.home, "AFC Bournemouth");
    assert.equal(ev.away, "Brentford");
    assert.equal(ev.homeScore, 0);
    assert.equal(ev.awayScore, 1);
    assert.equal(ev.displayClock, "37'");
    assert.equal(ev.period, 1);
    assert.equal(ev.statusState, "in");
    assert.equal(ev.completed, false);
    const cls = classifyEspnLiveStatus(ev);
    assert.equal(cls.status, "LIVE");
    assert.equal(cls.finished, false);
  });

  it("marks FT only when ESPN publishes completed/post", () => {
    const ev = parseEspnScoreboard(ESPN_FT, "eng.1")[0];
    assert.ok(ev);
    assert.equal(ev.homeScore, 1);
    assert.equal(ev.awayScore, 2);
    const cls = classifyEspnLiveStatus(ev);
    assert.equal(cls.status, "FT");
    assert.equal(cls.finished, true);
  });
});

describe("live ingest + overlay", () => {
  it("persists ESPN live onto StorageProvider and overlays the board", async () => {
    const root = mkdtempSync(join(tmpdir(), "bm-live-"));
    const ingest = await ingestLiveStates({
      targets: [
        {
          event_id: "de3b08b74a8249c647ee0e42",
          home: "AFC Bournemouth",
          away: "Brentford",
          kickoff_utc: "2026-09-12T14:00:00.000Z",
        },
      ],
      labBRoot: root,
      nowIso: "2026-09-12T14:37:00.000Z",
      jsonText: ESPN_LIVE,
    });
    assert.equal(ingest.written, 1);
    const row = getStorage(root).loadLiveState("de3b08b74a8249c647ee0e42");
    assert.ok(row);
    assert.equal(row.status, "LIVE");
    assert.equal(row.home_goals, 0);
    assert.equal(row.away_goals, 1);
    assert.equal(row.minute, "37'");
    const overlaid = overlayLiveOnEvents(
      [{ event_id: "de3b08b74a8249c647ee0e42", status: "UPCOMING" }],
      [row],
    );
    assert.equal((overlaid[0] as { status: string }).status, "LIVE");
    assert.equal((overlaid[0] as { result: string }).result, "0–1");
    const fromLab = overlayLiveOnEvents(
      [{ event_id: "de3b08b74a8249c647ee0e42", status: "LIVE", score: "0-1", note: "39'" }],
      [],
    );
    assert.equal((fromLab[0] as { home_goals: number }).home_goals, 0);
    assert.equal((fromLab[0] as { away_goals: number }).away_goals, 1);
    assert.equal((fromLab[0] as { minute: string }).minute, "39'");
  });
});

describe("settlement of NO_PREDICTION from real FT", () => {
  it("records outcome without inventing a selection winner", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-settle-"));
    const ev = parseEspnScoreboard(ESPN_FT, "eng.1")[0]!;
    const live = liveStateFromEspn("de3b08b74a8249c647ee0e42", ev, "2026-09-12T16:00:00.000Z");
    const result = settleFromLiveState({
      live,
      labBRoot: root,
      nowIso: "2026-09-12T16:00:00.000Z",
      prediction: {
        event_id: "de3b08b74a8249c647ee0e42",
        kind: "NO_PREDICTION",
        selection: null,
        model_version: "NO_PREDICTION",
      },
    });
    assert.equal(result.settled, true);
    assert.equal(result.result, "1-2");
    assert.equal(result.settlement?.outcome, "UNSETTLED");
    assert.equal(result.settlement?.selection, null);
    assert.equal(result.learning_written, true);
  });

  it("does not settle while the match is still in play", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-nosettle-"));
    const ev = parseEspnScoreboard(ESPN_LIVE, "eng.1")[0]!;
    const live = liveStateFromEspn("de3b08b74a8249c647ee0e42", ev, "2026-09-12T14:37:00.000Z");
    const result = settleFromLiveState({ live, labBRoot: root });
    assert.equal(result.settled, false);
    assert.equal(result.reason, "event_not_finished");
  });
});

describe("remote mirror merge-safe live/settlement/learning slices", () => {
  it("keeps remote live and settlement rows when a later publish sends empty arrays", async () => {
    process.env.BETMIND_RUNTIME_PUBLISH_SECRET = "s3cret";
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const live = {
      event_id: "de3b08b74a8249c647ee0e42",
      published_at: "2026-09-12T14:37:00.000Z",
      status: "LIVE",
      home: "AFC Bournemouth",
      away: "Brentford",
      home_goals: 0,
      away_goals: 1,
      minute: "37'",
      period: 1,
      source: "espn",
      source_status: "STATUS_FIRST_HALF",
      source_detail: "37'",
      observed_at: "2026-09-12T14:37:00.000Z",
      finished: false,
    };
    const first = await acceptRuntimeIngest({
      payload: samplePayload("2026-09-12T14:37:00.000Z"),
      live_states: [live],
      settlements: [
        {
          event_id: "old-ft",
          published_at: "2026-09-11T18:00:00.000Z",
          payload: { event_id: "old-ft", result: "2-1", settled_at: "2026-09-11T18:00:00.000Z" },
        },
      ],
      learning_cases: [
        {
          event_id: "old-ft",
          published_at: "2026-09-11T18:01:00.000Z",
          payload: { event_id: "old-ft", result: "2-1" },
        },
      ],
    });
    assert.equal(first.ok, true);
    const second = await acceptRuntimeIngest({ payload: samplePayload("2026-09-12T14:40:00.000Z") });
    assert.equal(second.ok, true);
    const art = await mem.read();
    assert.ok(findLiveInRemoteMirror(art, "de3b08b74a8249c647ee0e42"));
    assert.ok(findSettlementInRemoteMirror(art, "old-ft"));
    assert.ok(findLearningInRemoteMirror(art, "old-ft"));
    assert.equal(findLiveInRemoteMirror(art, "de3b08b74a8249c647ee0e42")?.away_goals, 1);
  });

  it("mergeByEventId keeps prior rows when incoming is empty", () => {
    const kept = mergeByEventId(
      [{ event_id: "a", published_at: "1" }],
      [],
    );
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.event_id, "a");
  });

  it("keeps Lab payload.live_snapshots when a later publish sends empty live_states", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    await writeRemoteMirror({
      ...samplePayload("2026-09-12T14:39:00.000Z"),
      live_snapshots: [
        {
          event_id: "de3b08b74a8249c647ee0e42",
          published_at: "2026-09-12T14:39:00.000Z",
          status: "LIVE",
          home: "AFC Bournemouth",
          away: "Brentford",
          score: "0-1",
          minute: "39'",
          source: "espn_scoreboard",
          observed_at: "2026-09-12T14:39:00.000Z",
          finished: false,
        },
      ],
    });
    const second = await writeRemoteMirror(samplePayload("2026-09-12T14:41:00.000Z"));
    assert.equal(second.ok, true);
    const art = await mem.read();
    const live = findLiveInRemoteMirror(art, "de3b08b74a8249c647ee0e42");
    assert.ok(live);
    assert.equal(live.home_goals, 0);
    assert.equal(live.away_goals, 1);
    assert.equal(live.minute, "39'");
    assert.ok(Array.isArray(art?.payload.live_snapshots) && art.payload.live_snapshots.length >= 1);
  });

  it("treats a recent live_snapshot as freshness even if published_at is older", () => {
    const art = {
      schema: "betmind-remote-mirror/1" as const,
      published_at: "2026-09-12T14:00:00.000Z",
      payload: {
        published_at: "2026-09-12T14:00:00.000Z",
        components: { brain: "ONLINE" },
        live_snapshots: [
          {
            event_id: "de3b08b74a8249c647ee0e42",
            published_at: "2026-09-12T14:39:00.000Z",
            status: "LIVE",
            home_goals: 0,
            away_goals: 1,
            minute: "39'",
            source: "espn_scoreboard",
            observed_at: "2026-09-12T14:39:00.000Z",
            finished: false,
          },
        ],
      },
      board_events: [],
      neon_in_use: false as const,
      backend: "memory" as const,
    };
    const at = remoteMirrorActivityAt(art);
    assert.equal(at, "2026-09-12T14:39:00.000Z");
    const { fresh } = remoteFreshness(at!, Date.parse("2026-09-12T14:42:00.000Z"));
    assert.equal(fresh, true);
  });
});

describe("Vercel event detail shows remote dossier + live, not only dossier_not_mirrored", () => {
  it("returns dossier_state=ok and live when Blob has both", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const dossier = {
      event: {
        event_id: "de3b08b74a8249c647ee0e42",
        home: "AFC Bournemouth",
        away: "Brentford",
        competition: "eng.1",
        kickoff_utc: "2026-09-12T14:00:00.000Z",
        sport: "soccer",
        status: "ANALYZED",
      },
      cycle: { cycle_number: 1, last_cycle_at: "2026-09-12T13:40:00.000Z", model_version: "NO_PREDICTION" },
      independent_model: { probability: null, note: "NO PREDICTION", reason_codes: ["independent_model"] },
      features: [],
      research: [],
      market: { probability: null, note: "compare only" },
    };
    await writeRemoteMirror(
      samplePayload("2026-09-12T14:37:00.000Z"),
      [
        {
          event_id: "de3b08b74a8249c647ee0e42",
          bucket: "ANALYZED",
          published_at: "2026-09-12T13:40:00.000Z",
          payload: {
            event_id: "de3b08b74a8249c647ee0e42",
            label: "AFC Bournemouth vs Brentford",
            home_or_a: "AFC Bournemouth",
            away_or_b: "Brentford",
          },
        },
      ],
      [
        {
          event_id: "de3b08b74a8249c647ee0e42",
          published_at: "2026-09-12T13:40:00.000Z",
          dossier,
          dossier_version: null,
        },
      ],
      {
        live_states: [
          {
            event_id: "de3b08b74a8249c647ee0e42",
            published_at: "2026-09-12T14:37:00.000Z",
            status: "LIVE",
            home: "AFC Bournemouth",
            away: "Brentford",
            home_goals: 0,
            away_goals: 1,
            minute: "37'",
            period: 1,
            source: "espn",
            source_status: "STATUS_FIRST_HALF",
            source_detail: "37'",
            observed_at: "2026-09-12T14:37:00.000Z",
            finished: false,
          },
        ],
      },
    );

    const prev = process.cwd();
    const cwd = mkdtempSync(join(tmpdir(), "bm-vercel-live-"));
    process.chdir(cwd);
    try {
      const res = await GET(new Request("http://localhost/api/betmind/event/de3b08b74a8249c647ee0e42"), {
        params: Promise.resolve({ id: "de3b08b74a8249c647ee0e42" }),
      });
      assert.equal(res.status, 200);
      const json = (await res.json()) as {
        dossier_state?: string;
        dossier?: { event?: { event_id?: string } };
        live?: { status?: string; away_goals?: number };
        prediction_kind?: string;
        error?: string;
      };
      assert.equal(json.dossier_state, "ok");
      assert.equal(json.dossier?.event?.event_id, "de3b08b74a8249c647ee0e42");
      assert.equal(json.live?.status, "LIVE");
      assert.equal(json.live?.away_goals, 1);
      assert.equal(json.prediction_kind, "NO_PREDICTION");
      assert.notEqual(json.error, "dossier_not_mirrored");
    } finally {
      process.chdir(prev);
    }
  });
});
