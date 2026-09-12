/**
 * GET /api/betmind/analyzed lists remote dossiers from the memory mirror.
 * Must not 500 when Lab B FS is absent.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET } from "@/app/api/betmind/analyzed/route";
import { NEON_IN_USE } from "@/domain/storage";
import {
  createMemoryRemoteMirrorStore,
  setRemoteMirrorStoreOverride,
  writeRemoteMirror,
} from "@/domain/eval/betmind-runtime/remote-mirror";

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
});

describe("GET /api/betmind/analyzed remote mirror fixture", () => {
  it("never uses Neon", () => {
    assert.equal(NEON_IN_USE, false);
  });

  it("returns 200 with remote dossiers and does not invent probabilities", async () => {
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const dossier = {
      event: {
        event_id: "ev-remote-1",
        home: "Alpha",
        away: "Beta",
        competition: "Bundesliga",
        kickoff_utc: "2026-09-13T14:00:00.000Z",
        sport: "soccer",
        status: "UPCOMING",
      },
      independent_model: {
        probability: null,
        model_version: "INDEPENDENT_POISSON_v1",
        decision: "INSUFFICIENT DATA",
        note: "NO_PREDICTION",
        reason_codes: ["INSUFFICIENT_DATA"],
      },
      features: [{ name: "form", value: null, status: "UNAVAILABLE" }],
      research: [],
      lineage: { sources_consulted: [], odds_entered_model: false },
      analyzed_at: "2026-09-12T19:00:00.000Z",
      real_money: false,
    };
    const written = await writeRemoteMirror(
      {
        published_at: "2026-09-12T19:00:00.000Z",
        components: { brain: "ONLINE" },
        observatory: { next_events: [] },
      },
      [],
      [
        {
          event_id: "ev-remote-1",
          published_at: "2026-09-12T19:00:00.000Z",
          dossier,
          dossier_version: "INDEPENDENT_POISSON_v1",
        },
      ],
    );
    assert.equal(written.ok, true);

    const res = await GET();
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok?: boolean;
      total?: number;
      events?: Array<{ event_id?: string; home?: string; strong?: boolean; favorite_1x2?: string | null }>;
    };
    assert.equal(body.ok, true);
    assert.ok((body.total ?? 0) >= 1);
    const hit = body.events?.find((e) => e.event_id === "ev-remote-1");
    assert.ok(hit);
    assert.equal(hit.home, "Alpha");
    assert.equal(hit.strong, true);
    assert.equal(hit.favorite_1x2, null);
  });
});
