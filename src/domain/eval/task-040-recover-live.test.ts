import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AdapterPull036 } from "@/domain/eval/prospective-036/adapter";
import { createFixtureAdapter, hashRawJson036 } from "@/domain/eval/prospective-036/sources";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { ProspectiveIntegrityError } from "@/domain/eval/prospective-036/integrity";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { runTask039, isStale039UiReport } from "@/domain/eval/live-039/lab";
import { getOddsApiKey } from "@/domain/eval/live-039/sources";
import { availableAt039 } from "@/domain/eval/live-039/classify";
import { lastAtOrBeforeCutoff039, t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { auditTask040 } from "@/domain/eval/recover-040/audit";
import { loadExp040Config, sourceStore040 } from "@/domain/eval/recover-040/config";
import { inventory040, asOfComplete1x2Books040 } from "@/domain/eval/recover-040/inventory";
import { recoverLocks040, assertDecisionHasNoSettlement040 } from "@/domain/eval/recover-040/lock";
import { runTask040 } from "@/domain/eval/recover-040/lab";

function tmpStore(): string {
  return mkdtempSync(join(tmpdir(), "task040-"));
}

function okPull(over: Partial<AdapterPull036> = {}): AdapterPull036 {
  const events = [
    {
      source_event_id: "e1",
      competition: "soccer_epl",
      season: "2026",
      home_team: "Arsenal",
      away_team: "Chelsea",
      kickoff_at_utc: "2026-10-03T16:00:00.000Z",
    },
  ];
  const quotes = [
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "HOME",
      odds_decimal: 1.9,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|HOME",
      source_timestamp_utc: "2026-10-03T14:00:00.000Z",
    },
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "DRAW",
      odds_decimal: 3.5,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|DRAW",
      source_timestamp_utc: "2026-10-03T14:00:00.000Z",
    },
    {
      source_event_id: "e1",
      market: "1X2",
      selection: "AWAY",
      odds_decimal: 4.2,
      bookmaker: "pinnacle",
      source_record_id: "e1|pinnacle|1X2|AWAY",
      source_timestamp_utc: "2026-10-03T14:00:00.000Z",
    },
  ];
  return {
    source: "the-odds-api",
    status: "ok",
    error: null,
    requested_at_utc: "2026-10-03T14:00:01.000Z",
    received_at_utc: "2026-10-03T14:00:01.000Z",
    provenance: "the-odds-api live",
    events,
    quotes,
    ...hashRawJson036({ events, quotes }),
    ...over,
  };
}

describe("TASK 040 recover live loop", () => {
  it("1 collector and audit share THE_ODDS_API_KEY env var", () => {
    const a = process.env.THE_ODDS_API_KEY;
    const b = getOddsApiKey();
    assert.equal(b, a && a.length > 0 ? a : undefined);
    assert.equal(loadExp040Config().consume_task_039_store, true);
  });

  it("2 collector and audit share the same task-039 store path", () => {
    assert.equal(sourceStore040(), storeRoot039());
  });

  it("3 persisted quote rows are recovered by audit/lab", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const report = await runTask040({ storeRoot: root, recoverLocks: true });
    assert.ok(report.QUOTE_OBSERVATIONS >= 3);
    assert.equal(report.FINAL_VERDICT === "LIVE_NOT_CONFIGURED", false);
    const audit = auditTask040(report);
    assert.equal(audit.ok, true);
  });

  it("4 events=0 pull does not imply quotes=0 when store already populated", async () => {
    const root = tmpStore();
    const store = loadStore039(root);
    await collectOnce039({
      store,
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const beforeQ = store.quotes.length;
    const second = await collectOnce039({
      store,
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:05:01.000Z",
    });
    assert.equal(second.events, 0);
    assert.ok(beforeQ > 0);
    assert.ok(store.quotes.length >= beforeQ);
  });

  it("5 quote rows reconstruct event presence when events catalog exists", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const inv = inventory040(loadStore039(root));
    assert.equal(inv.EVENTS_DISCOVERED, 1);
    assert.equal(inv.EVENTS_RECONSTRUCTED, 1);
    assert.ok(inv.QUOTE_OBSERVATIONS >= 3);
  });

  it("6 available_at is not replaced by collected_at", () => {
    assert.equal(availableAt039("2026-10-03T14:00:00.000Z"), "2026-10-03T14:00:00.000Z");
    assert.equal(availableAt039(null), null);
    const root = tmpStore();
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "quotes.jsonl"),
      `${JSON.stringify({
        event_id: "e1",
        market: "1X2",
        bookmaker: "pinnacle",
        outcome: "HOME",
        price: 1.9,
        source_quote_timestamp: "2026-10-03T14:00:00.000Z",
        collected_at: "2026-10-03T15:00:00.000Z",
        available_at: "2026-10-03T14:00:00.000Z",
        raw_payload_hash: "x",
        temporal_class: "STRICT",
        match_status: "MATCH_EXACT",
        window: null,
        offset_seconds_from_kickoff: null,
        coverage_status: "OUT_OF_WINDOW",
      })}\n`,
    );
    writeFileSync(join(root, "events.jsonl"), "");
    const store = loadStore039(root);
    assert.equal(store.quotes[0]!.available_at, "2026-10-03T14:00:00.000Z");
    assert.notEqual(store.quotes[0]!.available_at, store.quotes[0]!.collected_at);
  });

  it("7 T-1h AS_OF never uses quotes after cutoff", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const store = loadStore039(root);
    const ev = store.events[0]!;
    const cutoff = t1hCutoffMs039(ev.commence_time!)!;
    const hit = asOfComplete1x2Books040(store, ev);
    assert.ok(hit);
    for (const q of hit!.chosen) {
      assert.ok(Date.parse(q.available_at!) <= cutoff);
    }
    const future = lastAtOrBeforeCutoff039(
      [{ sourceMs: cutoff + 1, available_at: "2026-10-03T15:00:01.000Z" }],
      cutoff,
    );
    assert.equal(future, null);
  });

  it("8 LOCK is immutable", () => {
    assert.throws(
      () =>
        mutateDecision(
          {
            decision_id: "d",
            event_id: "e",
            decision_timestamp_utc: "2026-10-03T15:00:00.000Z",
            window: "T-1h",
            state: "LOCKED",
            market: "1X2",
            home_raw: 0.4,
            draw_raw: 0.3,
            away_raw: 0.3,
            home_devig: 0.4,
            draw_devig: 0.3,
            away_devig: 0.3,
            overround: 1.05,
            bookmaker: "pinnacle",
            observation_ids: [],
            observation_only: true,
            decision_context_hash: "h",
          },
          { home_devig: 0.9 },
        ),
      (e) => e instanceof ProspectiveIntegrityError,
    );
  });

  it("9 settlement does not enter DecisionContext", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const store = loadStore039(root);
    recoverLocks040(store);
    const d = store.decisions[0]!;
    assert.ok(d);
    assertDecisionHasNoSettlement040(d, { home_score: 1, away_score: 0, FT: "1-0" });
    assert.equal("home_score" in d, false);
    assert.equal(d.observation_only, true);
  });

  it("10 audit does not declare LIVE_NOT_CONFIGURED when live data exists", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull())],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const report = await runTask040({ storeRoot: root });
    assert.notEqual(report.FINAL_VERDICT, "LIVE_NOT_CONFIGURED");
    assert.ok(report.QUOTE_OBSERVATIONS > 0);
    assert.equal(auditTask040(report).ok, true);
    assert.equal(
      isStale039UiReport(
        {
          FINAL_VERDICT: "LIVE_NOT_CONFIGURED",
          QUOTE_OBSERVATIONS: 0,
          EVENTS_DISCOVERED: 0,
        } as never,
        1,
        10,
      ),
      true,
    );
  });

  it("039 empty-store missing key still LIVE_NOT_CONFIGURED", async () => {
    const empty = await runTask039({ storeRoot: tmpStore(), livePull: false });
    assert.equal(empty.FINAL_VERDICT, "LIVE_NOT_CONFIGURED");
    assert.equal(empty.COLLECTION_STATUS, "BLOCKED");
  });
});
