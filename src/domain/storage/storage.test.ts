import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStorage, NEON_IN_USE, NEON_STATUS_IT, storageBanner } from "@/domain/storage";

describe("StorageProvider filesystem — works without Neon", () => {
  it("declares NEON NON UTILIZZATO and never requires DATABASE_URL", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const root = mkdtempSync(join(tmpdir(), "bm-store-"));
    const store = getStorage(root);
    assert.equal(store.backend, "filesystem");
    assert.equal(store.neon_in_use, false);
    assert.equal(NEON_IN_USE, false);
    assert.equal(NEON_STATUS_IT, "NEON NON UTILIZZATO");
    assert.match(storageBanner().note, /NEON NON UTILIZZATO/);
    store.appendJsonl("events.jsonl", { event_id: "e1", home: "A", away: "B" });
    const rows = store.readJsonl<{ event_id: string }>("events.jsonl");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.event_id, "e1");
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });

  it("ignores DATABASE_URL — Neon is not a fallback", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@unused.neon.tech/neondb";
    const root = mkdtempSync(join(tmpdir(), "bm-store-ign-"));
    const store = getStorage(root);
    store.publishRuntime({ ok: true, neon: false }, "2026-09-11T12:00:00.000Z");
    const runtime = store.loadRuntime();
    assert.equal(runtime?.published_at, "2026-09-11T12:00:00.000Z");
    assert.equal(store.neon_in_use, false);
    assert.match(storageBanner().note, /ignored/);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
    else delete process.env.DATABASE_URL;
  });

  it("mirrors runtime, board, dossier, light, history on disk", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-store-m-"));
    const store = getStorage(root);
    store.upsertBoardEvent({
      event_id: "ev-1",
      bucket: "QUEUED",
      published_at: "2026-09-11T12:00:00.000Z",
      payload: { event_id: "ev-1", home: "A", away: "B" },
    });
    store.upsertDossier("ev-1", { event: { event_id: "ev-1" }, independent_model: { probability: null } });
    store.upsertLightAnalysis({ event_id: "ev-1", analyzed_at: "2026-09-11T12:01:00.000Z" });
    store.upsertLightHistory({ rows: [{ date: "2026-01-01" }], fetched_at: "2026-09-11T12:00:00.000Z" });
    store.appendAnalysisCycle({ cycle_number: 1 });

    assert.equal(store.loadBoardEvents().length, 1);
    assert.ok(store.loadDossier("ev-1"));
    assert.equal((store.loadLightAnalysis("ev-1") as { event_id: string }).event_id, "ev-1");
    assert.ok(store.loadLightHistory());
  });
});
