import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AdapterPull036 } from "@/domain/eval/prospective-036/adapter";
import { createFixtureAdapter, hashRawJson036 } from "@/domain/eval/prospective-036/sources";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { ProspectiveIntegrityError } from "@/domain/eval/prospective-036/integrity";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import { appendSettlement039 } from "@/domain/eval/live-039/store";
import { recoverLocks040 } from "@/domain/eval/recover-040/lock";
import { auditTask041 } from "@/domain/eval/close-041/audit";
import { loadExp041Config, sourceStore041 } from "@/domain/eval/close-041/config";
import { buildScoredRows041, temporalSplit041 } from "@/domain/eval/close-041/eval";
import { runTask041 } from "@/domain/eval/close-041/lab";
import { storeRoot039 } from "@/domain/eval/live-039/config";

function tmpStore(): string {
  return mkdtempSync(join(tmpdir(), "task041-"));
}

function okPull(kickoff: string, id: string): AdapterPull036 {
  const events = [
    {
      source_event_id: id,
      competition: "soccer_epl",
      season: "2026",
      home_team: "Arsenal",
      away_team: "Chelsea",
      kickoff_at_utc: kickoff,
    },
  ];
  const quotes = [
    {
      source_event_id: id,
      market: "1X2",
      selection: "HOME",
      odds_decimal: 1.9,
      bookmaker: "pinnacle",
      source_record_id: `${id}|pinnacle|1X2|HOME`,
      source_timestamp_utc: "2026-10-03T14:00:00.000Z",
    },
    {
      source_event_id: id,
      market: "1X2",
      selection: "DRAW",
      odds_decimal: 3.4,
      bookmaker: "pinnacle",
      source_record_id: `${id}|pinnacle|1X2|DRAW`,
      source_timestamp_utc: "2026-10-03T14:00:00.000Z",
    },
    {
      source_event_id: id,
      market: "1X2",
      selection: "AWAY",
      odds_decimal: 4.0,
      bookmaker: "pinnacle",
      source_record_id: `${id}|pinnacle|1X2|AWAY`,
      source_timestamp_utc: "2026-10-03T14:00:00.000Z",
    },
  ];
  return {
    source: "the-odds-api",
    status: "ok",
    error: null,
    requested_at_utc: "2026-10-03T14:00:01.000Z",
    received_at_utc: "2026-10-03T14:00:01.000Z",
    provenance: "fixture",
    events,
    quotes,
    ...hashRawJson036({ events, quotes }),
  };
}

describe("TASK 041 prospective close", () => {
  it("frozen flags forbid TASK 042 and historical hunt", () => {
    const cfg = loadExp041Config();
    assert.equal(cfg.open_task_042, false);
    assert.equal(cfg.historical_hunt, false);
    assert.equal(cfg.settled_target, 100);
    assert.equal(sourceStore041(), storeRoot039());
  });

  it("settled < 100 → INSUFFICIENT_DATA_FINAL not NO_DEMONSTRATED_EDGE", async () => {
    const root = tmpStore();
    await collectOnce039({
      store: loadStore039(root),
      adapters: [createFixtureAdapter(okPull("2026-10-03T16:00:00.000Z", "e1"))],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const report = await runTask041({ storeRoot: root, livePull: false, reveal: false });
    assert.equal(report.FINAL_VERDICT, "INSUFFICIENT_DATA_FINAL");
    assert.ok(report.MISSING_TO_100 >= 99);
    assert.equal(report.BETS, 0);
    assert.equal(report.BANKROLL, "—");
    assert.equal(auditTask041(report).ok, true);
  });

  it("LOCK immutable and settlement isolated", async () => {
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
    const root = tmpStore();
    const store = loadStore039(root);
    await collectOnce039({
      store,
      adapters: [createFixtureAdapter(okPull("2026-10-03T16:00:00.000Z", "e1"))],
      nowUtc: "2026-10-03T14:00:01.000Z",
    });
    const lock = recoverLocks040(store);
    assert.ok(store.events.length >= 1, "events persisted");
    assert.ok(store.quotes.length >= 3, "quotes persisted");
    assert.ok(lock.rows.length >= 1 || store.decisions.length >= 1, `locked=${lock.locked} decisions=${store.decisions.length} quotes=${store.quotes.length} class=${store.quotes[0]?.temporal_class}`);
    const d = store.decisions[0]!;
    assert.equal("FT" in d, false);
    assert.equal("home_score" in d, false);
    assert.equal(d.observation_only, true);
  });

  it("temporal split is ordered and holdout is last", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      event_id: `e${i}`,
      kickoff: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      actual: 0 as const,
      market: [0.5, 0.25, 0.25] as [number, number, number],
    }));
    const split = temporalSplit041(rows);
    assert.equal(split.train.length + split.val.length + split.test.length + split.holdout.length, 100);
    assert.ok(Date.parse(split.holdout[0]!.kickoff) > Date.parse(split.test.at(-1)!.kickoff));
  });

  it("scored rows require both LOCK and verified settlement", () => {
    const root = tmpStore();
    const store = loadStore039(root);
    appendSettlement039(store, {
      event_id: "missing-lock",
      result_source: "test",
      settled_at: "2026-10-04T00:00:00.000Z",
      home_score: 1,
      away_score: 0,
      outcome: "HOME",
    });
    assert.equal(buildScoredRows041(store).length, 0);
  });
});
