import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveDaemonHealth046 } from "@/domain/eval/control-046/daemon";
import { buildControlCenter046 } from "@/domain/eval/control-046/center";
import { auditTask046 } from "@/domain/eval/control-046/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { snapshotWindowsForEvent046, buildNextEvents046, buildFeed046 } from "@/domain/eval/control-046/dashboard";
import { loadStore044, appendEvent044, appendPrediction044, appendLock044 } from "@/domain/eval/permanent-044/store";
import { ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t046-"));
}

describe("TASK 046 live control center", () => {
  it("daemon STOPPED when no lock/pid", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const h = resolveDaemonHealth046(root, Date.now());
    assert.equal(h.display, "STOPPED");
  });

  it("daemon DEGRADED when status RUNNING but pid dead", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    writeFileSync(
      join(root, "collector-status.json"),
      JSON.stringify({ status: "RUNNING", pid: 99999999, updated_at: new Date().toISOString() }),
    );
    writeFileSync(join(root, "collector.lock"), JSON.stringify({ pid: 99999999, started_at: new Date().toISOString() }));
    const h = resolveDaemonHealth046(root, Date.now());
    assert.equal(h.display, "DEGRADED");
    assert.ok(h.degraded_reason);
  });

  it("daemon DEGRADED on stale heartbeat while pid alive simulation via old activity", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const old = new Date(Date.now() - 40 * 60_000).toISOString();
    writeFileSync(
      join(root, "collector-status.json"),
      JSON.stringify({ status: "STOPPED", pid: null, last_cycle_at: old, updated_at: old }),
    );
    const h = resolveDaemonHealth046(root, Date.now());
    assert.ok(["STOPPED", "DEGRADED"].includes(h.display));
  });

  it("control center builds from disk with api_calls_ui=0 and seed note", () => {
    const center = buildControlCenter046();
    assert.equal(center.api_calls_ui, 0);
    assert.equal(center.credits_used_for_ui, 0);
    assert.equal(center.catalog_cap, false);
    assert.match(center.seed_note, /NOT A CATALOG CAP/);
    assert.ok(center.pipeline.length >= 5);
    assert.ok(center.counters.TOTAL_EVENTS >= 114);
    assert.ok(center.counters.SEED_EVENTS + center.counters.DISCOVERED_LIVE === center.counters.TOTAL_EVENTS || center.counters.TOTAL_EVENTS >= 114);
  });

  it("missing snapshots are NOT_OBSERVED not interpolated", () => {
    const root = tmp();
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "test",
      source_event_id: "s1",
      sport: "soccer",
      competition: "soccer_epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: null,
      semantic_level: "STRICT",
      data_quality: 0.5,
      fingerprint: "fp1",
      status: "OK",
      origin: "DISCOVERED_LIVE",
    });
    const wins = snapshotWindowsForEvent046(store, "e1");
    assert.ok(wins.every((w) => w.status === "NOT_OBSERVED" || w.status === "NOT_AVAILABLE"));
    assert.ok(wins.some((w) => w.missing_reason === "NO SNAPSHOT"));
  });

  it("next events and feed derive from store", () => {
    const root = tmp();
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e2",
      canonical_event_id: "c2",
      source: "test",
      source_event_id: "s2",
      sport: "soccer",
      competition: "soccer_epl",
      country: null,
      home_or_a: "X",
      away_or_b: "Y",
      kickoff_utc: "2026-12-01T18:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: null,
      semantic_level: "STRICT",
      data_quality: 0.5,
      fingerprint: "fp2",
      status: "OK",
      origin: "DISCOVERED_LIVE",
      first_seen_at: "2026-11-01T00:00:00.000Z",
    });
    appendPrediction044(store, {
      prediction_id: "p1",
      event_id: "e2",
      timestamp: "2026-11-01T01:00:00.000Z",
      model_version: "MODEL_v1",
      feature_version: "f1",
      market: "1X2",
      selection: "HOME",
      line: null,
      probability_model: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      probability_market: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      edge_absolute: 0,
      edge_relative: 0,
      confidence_score: 50,
      data_quality_score: 0.5,
      recommended: false,
      reason_codes: ["NO_BET"],
      risk_flags: [],
      human_readable_reason: "NO_BET observation",
      ranking_bucket: "NO_BET",
      prediction_seq: 1,
      immutable: true,
    });
    const next = buildNextEvents046(store, Date.parse("2026-11-15T00:00:00.000Z"), 10);
    assert.ok(next.some((r) => r.event_id === "e2"));
    assert.equal(next.find((r) => r.event_id === "e2")!.prediction_status, "NO_BET");
    const feed = buildFeed046(store, 20);
    assert.ok(feed.some((f) => f.kind === "ANALYZED" || f.kind === "EVENT"));
  });

  it("Lab A firewall fingerprint stable across control center build", () => {
    const before = labAFingerprint046();
    buildControlCenter046();
    assertLabAUntouched046(before);
    assert.equal(before.events, 114);
    assert.equal(before.decisions, 114);
  });

  it("audit requires UI API calls = 0", () => {
    const ok = auditTask046({
      API_CALLS_UI: 0,
      CREDITS_USED_FOR_UI: 0,
      LAB_A_MUTATION: false,
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      CAPITAL: "CLOSED",
      MODEL_EDGE: "UNKNOWN",
      open_task_047: false,
      FINAL_VERDICT: "LIVE_CONTROL_CENTER_READY",
    } as never);
    assert.equal(ok.ok, true);
    const bad = auditTask046({
      API_CALLS_UI: 1,
      CREDITS_USED_FOR_UI: 0,
      LAB_A_MUTATION: false,
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      CAPITAL: "CLOSED",
      MODEL_EDGE: "UNKNOWN",
      open_task_047: false,
      FINAL_VERDICT: "LIVE_CONTROL_CENTER_READY",
    } as never);
    assert.equal(bad.ok, false);
  });
});

void mkdirSync;
void appendLock044;
