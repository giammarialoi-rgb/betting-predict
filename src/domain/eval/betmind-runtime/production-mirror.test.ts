import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SourceEntry } from "@/domain/eval/data-intelligence/types";
import {
  brainStatusIt,
  collectNeonUniverse,
  filterNeonUniverse,
  formatAgeIt,
  localLabStorePresent,
  neonEventsEmptyReason,
  operationalHasNeonSignal,
  overlayRegistryWithOperational,
  staleMirrorComponents,
  statusWordIt,
} from "@/domain/eval/betmind-runtime/production-mirror";

const REG: SourceEntry = {
  id: "understat",
  title: "Understat",
  priority: "medium",
  role: "CONTEXT",
  temporal_precision: "UNKNOWN",
  status: "UNAVAILABLE",
  reason: "In-memory placeholder",
  enters_independent_model: false,
};

describe("production mirror honesty", () => {
  it("treats an empty Lab B directory as missing — events.jsonl is the store", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-lab-"));
    mkdirSync(join(root, "schema"), { recursive: true });
    assert.equal(localLabStorePresent(root), false);
    writeFileSync(join(root, "events.jsonl"), "{}\n", "utf8");
    assert.equal(localLabStorePresent(root), true);
  });

  it("formats ages in Italian instead of raw milliseconds", () => {
    assert.equal(formatAgeIt(4_341_862_000), "50 giorni fa");
    assert.match(formatAgeIt(160_231), /min fa/);
    assert.equal(formatAgeIt(8_000), "8 s fa");
  });

  it("does not show STALE_MIRROR as the primary Italian phrase", () => {
    assert.match(brainStatusIt("STALE_MIRROR"), /Specchio Neon scaduto/);
    assert.equal(statusWordIt("OFFLINE"), "Offline");
    assert.equal(statusWordIt("RUNNING"), "Online");
  });

  it("stale components stay OFFLINE — never fake ONLINE from last-known RUNNING", () => {
    const c = staleMirrorComponents();
    assert.equal(c.brain, "OFFLINE");
    assert.equal(c.worker, "OFFLINE");
    assert.equal(c.data_pipeline, "OFFLINE");
  });

  it("overlays Neon operational stats onto in-memory UNAVAILABLE cards when Neon has data", () => {
    const cards = overlayRegistryWithOperational([REG], [
      {
        source_id: "understat",
        status: "ACTIVE",
        events_found: 81,
        observations_found: 596,
        last_success: "2026-09-11T09:16:35.638Z",
        last_event_label: null,
      },
    ]);
    assert.equal(cards[0]?.overlay, "neon_operational");
    assert.equal(cards[0]?.status, "ACTIVE");
    assert.match(String(cards[0]?.reason), /81 eventi/);
    assert.equal(operationalHasNeonSignal(cards), true);
  });

  it("does not invent ACTIVE when Neon operational has zero events", () => {
    const cards = overlayRegistryWithOperational([REG], [
      { source_id: "understat", status: "IDLE", events_found: 0, observations_found: 0 },
    ]);
    assert.equal(cards[0]?.status, "UNAVAILABLE");
    assert.equal(cards[0]?.overlay, "neon_operational");
  });

  it("stale ≠ empty: explains date filter vs missing mirror", () => {
    assert.match(
      neonEventsEmptyReason({
        remotePresent: false,
        remoteFresh: null,
        universeCount: 0,
        filteredCount: 0,
        date: "2026-09-11",
        sport: "football",
      }),
      /Nessuno specchio Neon/,
    );
    assert.match(
      neonEventsEmptyReason({
        remotePresent: true,
        remoteFresh: false,
        universeCount: 0,
        filteredCount: 0,
        date: "2026-09-11",
        sport: "ALL",
        storePresentLocalOnPublisher: true,
      }),
      /Nessuna partita nello specchio/,
    );
    assert.match(
      neonEventsEmptyReason({
        remotePresent: true,
        remoteFresh: true,
        universeCount: 40,
        filteredCount: 0,
        date: "2026-09-11",
        sport: "football",
      }),
      /altre date/,
    );
  });

  it("filters Neon universe by Rome calendar day without inventing rows", () => {
    const universe = collectNeonUniverse({
      next_events: [
        {
          event_id: "a",
          sport: "FOOTBALL",
          calendar_day: "2026-09-11",
          kickoff_utc: "2026-09-11T18:45:00Z",
        },
        {
          event_id: "b",
          sport: "TENNIS",
          calendar_day: "2026-09-12",
          kickoff_utc: "2026-09-12T10:00:00Z",
        },
      ],
    });
    const today = filterNeonUniverse(universe, { date: "2026-09-11", sport: "ALL" });
    assert.equal(today.length, 1);
    assert.equal((today[0] as { event_id: string }).event_id, "a");
  });
});
