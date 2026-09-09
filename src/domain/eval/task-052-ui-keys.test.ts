import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertUniqueReactKeys052,
  countDuplicateEventIds052,
  dedupeByEventId052,
  reactListKey052,
} from "@/domain/eval/ui-052/keys";
import { auditTask052 } from "@/domain/eval/ui-052/audit";
import { loadExp052Config } from "@/domain/eval/ui-052/config";
import { buildNextEvents046 } from "@/domain/eval/control-046/dashboard";
import { ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendEvent044 } from "@/domain/eval/permanent-044/store";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t052-"));
}

describe("TASK 052 duplicate keys + next_events robustness", () => {
  it("exp flags freeze capital and forbid TASK 053 / predictor edits", () => {
    const cfg = loadExp052Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.open_task_053, false);
    assert.equal(cfg.modify_predictor, false);
    assert.equal(cfg.modify_collector, false);
  });

  it("exact duplicate event_id case yields unique React keys", () => {
    const rows = [
      { event_id: "ABC", kickoff_utc: "2026-09-10T12:00:00.000Z", status: "A" },
      { event_id: "ABC", kickoff_utc: "2026-09-10T12:00:00.000Z", status: "A" },
    ];
    const keys = rows.map((e, i) => reactListKey052(e, i, "next"));
    const u = assertUniqueReactKeys052(keys);
    assert.equal(u.ok, true);
    assert.notEqual(keys[0], keys[1]);
  });

  it("two snapshots / markets / predictions of same event get distinct keys", () => {
    const rows = [
      { event_id: "E1", market: "1X2", selection: "HOME", kickoff_utc: "t1" },
      { event_id: "E1", market: "OU", selection: "OVER", kickoff_utc: "t1" },
      { event_id: "E1", prediction_id: "p1", market: "1X2" },
      { event_id: "E1", prediction_id: "p2", market: "1X2" },
    ];
    const keys = rows.map((r, i) => reactListKey052(r, i, "board"));
    assert.equal(assertUniqueReactKeys052(keys).ok, true);
  });

  it("empty list and missing secondary ids are safe", () => {
    assert.equal(assertUniqueReactKeys052([]).ok, true);
    const keys = [{ event_id: "X" }, { event_id: "X" }].map((r, i) => reactListKey052(r, i));
    assert.equal(assertUniqueReactKeys052(keys).ok, true);
  });

  it("ranking-style duplicates and multi-sport rows", () => {
    const rows = [
      { event_id: "A", rank: 1, sport: "soccer" },
      { event_id: "A", rank: 2, sport: "soccer" },
      { event_id: "B", rank: 1, sport: "tennis" },
    ];
    const keys = rows.map((r, i) => reactListKey052(r, i, "rank"));
    assert.equal(assertUniqueReactKeys052(keys).ok, true);
  });

  it("dedupeByEventId052 is last-wins and countDuplicateEventIds052 works", () => {
    const rows = [
      { event_id: "ABC", n: 1 },
      { event_id: "ABC", n: 2 },
      { event_id: "DEF", n: 1 },
    ];
    assert.equal(countDuplicateEventIds052(rows), 1);
    const d = dedupeByEventId052(rows);
    assert.equal(d.length, 2);
    assert.equal(d.find((x) => x.event_id === "ABC")!.n, 2);
  });

  it("buildNextEvents046 collapses accidental duplicate event_id rows", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    const base = {
      event_id: "dup1",
      canonical_event_id: "c1",
      source: "t",
      source_event_id: "s1",
      sport: "soccer",
      competition: "x",
      country: null as string | null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: "2026-11-01T00:00:00.000Z",
      semantic_level: "STRICT" as const,
      data_quality: 1,
      fingerprint: "fp-dup-1",
      status: "SCHEDULED",
    };
    appendEvent044(store, base);
    // Simulate concurrent append bypassing in-memory fingerprint set
    store.events.push({ ...base, collected_at_utc: "2026-11-02T00:00:00.000Z" });
    assert.equal(store.events.filter((e) => e.event_id === "dup1").length, 2);
    const now = Date.parse("2026-11-15T00:00:00.000Z");
    const rows = buildNextEvents046(store, now, 50);
    assert.equal(rows.filter((r) => r.event_id === "dup1").length, 1);
    assert.equal(countDuplicateEventIds052(rows), 0);
  });

  it("Lab A untouched + audit accepts READY shape", () => {
    const before = labAFingerprint046();
    assert.equal(before.events, 114);
    assertLabAUntouched046(before);
    const r = auditTask052({
      experiment_id: "exp_052_duplicate_keys_ui",
      task: "052",
      FINAL_VERDICT: "UI_ROBUSTNESS_READY",
      UI_STATUS: "PASS",
      DUPLICATE_KEYS: 0,
      DUPLICATE_EVENT_IDS_HANDLED: true,
      NEXT_EVENTS_RENDER: "PASS",
      EVENT_DETAIL_RENDER: "PASS",
      CAUSE: "test",
      STORE_DUP_EVENT_IDS: 1,
      NEXT_EVENTS_DUP_EVENT_IDS: 0,
      LAB_A_MUTATION: false,
      CAPITAL: "CLOSED",
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      OBSERVATORY_API_CALLS_UI: 0,
      open_task_053: false,
      fingerprint: "x",
      experiment_sha256: "y",
    });
    assert.equal(r.ok, true);
  });
});
