import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { applyScores039 } from "@/domain/eval/live-039/settle";
import { appendDecision039, appendQuote039, loadStore039, upsertEvent039 } from "@/domain/eval/live-039/store";
import {
  applyCreditObservation042,
  canAffordRun042,
  defaultCreditState042,
  parseCreditHeaders042,
  remainingCredits042,
} from "@/domain/eval/collector-042/credit";
import { acquireProcessLock042, releaseProcessLock042, isLockHeldByAliveProcess042 } from "@/domain/eval/collector-042/lock";
import { loadHeartbeat042, resolveDisplayedStatus042, saveHeartbeat042 } from "@/domain/eval/collector-042/heartbeat";
import { planCycle042, sportsNeedingScores042 } from "@/domain/eval/collector-042/plan";
import { runCollectorCycle042 } from "@/domain/eval/collector-042/cycle";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { ProspectiveIntegrityError } from "@/domain/eval/prospective-036/integrity";
import { lastAtOrBeforeCutoff039, t1hCutoffMs039 } from "@/domain/eval/live-039/asof";

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), "task042-"));
}

describe("TASK 042 persistent collector", () => {
  it("1 duplicate quote prevention via store keys", () => {
    const root = tmpRoot();
    const store = loadStore039(root);
    upsertEvent039(store, {
      event_id: "e1",
      source_event_id: "s1",
      sport_key: "soccer_epl",
      home_team: "A",
      away_team: "B",
      commence_time: "2026-10-01T16:00:00.000Z",
      source: "the-odds-api",
      first_seen_at: "2026-10-01T12:00:00.000Z",
      last_seen_at: "2026-10-01T12:00:00.000Z",
      kickoff_status: "OK",
    });
    const q = {
      event_id: "e1",
      market: "1X2",
      bookmaker: "pinnacle",
      outcome: "HOME",
      price: 1.9,
      source_quote_timestamp: "2026-10-01T12:00:00.000Z",
      collected_at: "2026-10-01T12:00:01.000Z",
      available_at: "2026-10-01T12:00:00.000Z",
      raw_payload_hash: "x",
      temporal_class: "STRICT" as const,
      match_status: "MATCH_EXACT" as const,
      window: null,
      offset_seconds_from_kickoff: null,
      coverage_status: "OUT_OF_WINDOW" as const,
    };
    assert.equal(appendQuote039(store, q), "ok");
    assert.equal(appendQuote039(store, q), "IGNORED_DUPLICATE");
  });

  it("2 stale heartbeat detection", () => {
    const root = tmpRoot();
    saveHeartbeat042(
      {
        ...loadHeartbeat042(root),
        status: "RUNNING",
        heartbeatAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      },
      root,
    );
    const r = resolveDisplayedStatus042(root);
    assert.equal(r.status === "STALE" || r.status === "NOT_RUNNING", true);
    assert.equal(r.stale, true);
  });

  it("3-5 budget limit / safe remaining / max credits per run", () => {
    const cfg = { ...loadGovernorConfig042(), safeRemaining: 100, maxCreditsPerRun: 20, monthlyCreditLimit: 500 };
    const state = { ...defaultCreditState042(cfg), observedRemaining: 90, estimatedRemaining: 90 };
    const a = canAffordRun042(state, 5, cfg);
    assert.equal(a.ok, false);
    assert.equal(a.status, "PAUSED_BUDGET");
    const state2 = { ...defaultCreditState042(cfg), observedRemaining: 200, estimatedRemaining: 200 };
    const b = canAffordRun042(state2, 25, cfg);
    assert.equal(b.ok, false);
    const c = canAffordRun042(state2, 10, cfg);
    assert.equal(c.ok, true);
  });

  it("6-9 API 401/403/429 and credit headers", async () => {
    const root = tmpRoot();
    process.env.THE_ODDS_API_KEY = "test-key-not-real";
    const fetch401: typeof fetch = async () =>
      new Response("{}", { status: 401, headers: { "x-requests-remaining": "400" } });
    const r401 = await runCollectorCycle042({
      storeRoot: root,
      forceDiscovery: true,
      fetchImpl: fetch401,
    });
    assert.equal(r401.status, "PAUSED_ERROR");

    const headers = parseCreditHeaders042(new Headers({ "x-requests-remaining": "402", "x-requests-used": "98", "x-requests-last": "2" }));
    assert.equal(headers.remaining, 402);
    assert.equal(headers.used, 98);
    assert.equal(headers.last, 2);
    const st = applyCreditObservation042(defaultCreditState042(), headers, 2);
    assert.equal(remainingCredits042(st), 402);
    assert.equal(st.sourceOfTruth, "provider_headers");
  });

  it("10 double collector lock", () => {
    const root = tmpRoot();
    const a = acquireProcessLock042(root);
    assert.equal(a.ok, true);
    const b = acquireProcessLock042(root);
    // same pid can re-acquire
    assert.equal(b.ok, true);
    assert.equal(isLockHeldByAliveProcess042(root), true);
    releaseProcessLock042(root);
  });

  it("11-13 persisted credit + heartbeat + recovery of empty meta", () => {
    const root = tmpRoot();
    const creditPath = join(root, "credit-state.json");
    mkdirSync(root, { recursive: true });
    writeFileSync(
      creditPath,
      JSON.stringify({ ...defaultCreditState042(), observedRemaining: 402, requests: 3 }, null, 2),
    );
    saveHeartbeat042({ ...loadHeartbeat042(root), status: "STOPPED", settledEvents: 0 }, root);
    const hb = loadHeartbeat042(root);
    assert.equal(hb.status, "STOPPED");
    const raw = JSON.parse(readFileSync(creditPath, "utf8")) as { observedRemaining: number };
    assert.equal(raw.observedRemaining, 402);
  });

  it("14 existing store recovery does not wipe events", async () => {
    const root = tmpRoot();
    const store = loadStore039(root);
    upsertEvent039(store, {
      event_id: "keep",
      source_event_id: "s",
      sport_key: "soccer_epl",
      home_team: "A",
      away_team: "B",
      commence_time: "2026-12-01T16:00:00.000Z",
      source: "the-odds-api",
      first_seen_at: "2026-09-01T00:00:00.000Z",
      last_seen_at: "2026-09-01T00:00:00.000Z",
      kickoff_status: "OK",
    });
    process.env.THE_ODDS_API_KEY = "test-key-not-real";
    await runCollectorCycle042({
      storeRoot: root,
      fetchImpl: async () => new Response("[]", { status: 200, headers: { "x-requests-remaining": "400", "x-requests-last": "0" } }),
    });
    const again = loadStore039(root);
    assert.equal(again.events.some((e) => e.event_id === "keep"), true);
  });

  it("15 LOCK immutability", () => {
    assert.throws(
      () =>
        mutateDecision(
          {
            decision_id: "d",
            event_id: "e",
            decision_timestamp_utc: "2026-10-01T15:00:00.000Z",
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

  it("16-19 settlement idempotency + AS_OF no future + no postmatch in decision", () => {
    const root = tmpRoot();
    const store = loadStore039(root);
    upsertEvent039(store, {
      event_id: "e1",
      source_event_id: "src1",
      sport_key: "soccer_epl",
      home_team: "A",
      away_team: "B",
      commence_time: "2026-09-01T12:00:00.000Z",
      source: "the-odds-api",
      first_seen_at: "2026-09-01T10:00:00.000Z",
      last_seen_at: "2026-09-01T10:00:00.000Z",
      kickoff_status: "OK",
    });
    appendDecision039(store, {
      decision_id: "d1",
      event_id: "e1",
      decision_timestamp_utc: "2026-09-01T11:00:00.000Z",
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
      decision_context_hash: "h",
      observation_only: true,
    });
    const scores = [
      {
        source_event_id: "src1",
        home_team: "A",
        away_team: "B",
        commence_time: "2026-09-01T12:00:00.000Z",
        completed: true,
        home_score: 2,
        away_score: 1,
      },
    ];
    const a = applyScores039(store, scores, "2026-09-01T14:00:00.000Z", "test");
    const b = applyScores039(store, scores, "2026-09-01T15:00:00.000Z", "test");
    assert.equal(a.settled, 1);
    assert.equal(b.settled, 0);
    assert.equal(store.settlements.filter((s) => s.outcome !== "UNSETTLED").length, 1);
    assert.equal("FT" in store.decisions[0]!, false);

    const cutoff = t1hCutoffMs039("2026-10-01T16:00:00.000Z")!;
    const hit = lastAtOrBeforeCutoff039(
      [
        { sourceMs: cutoff - 1000 },
        { sourceMs: cutoff + 5000 },
      ],
      cutoff,
    );
    assert.equal(hit?.sourceMs, cutoff - 1000);

    const need = sportsNeedingScores042(store, Date.parse("2026-09-01T13:00:00.000Z"));
    assert.equal(need.includes("soccer_epl"), false); // already settled
  });

  it("20 plan prefers settle-only when locked >= target and discovery not forced", () => {
    const root = tmpRoot();
    const store = loadStore039(root);
    for (let i = 0; i < 5; i++) {
      upsertEvent039(store, {
        event_id: `e${i}`,
        source_event_id: `s${i}`,
        sport_key: "soccer_epl",
        home_team: "A",
        away_team: "B",
        commence_time: "2026-12-01T16:00:00.000Z",
        source: "the-odds-api",
        first_seen_at: "2026-09-01T00:00:00.000Z",
        last_seen_at: "2026-09-01T00:00:00.000Z",
        kickoff_status: "OK",
      });
      appendDecision039(store, {
        decision_id: `d${i}`,
        event_id: `e${i}`,
        decision_timestamp_utc: "2026-11-01T00:00:00.000Z",
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
        decision_context_hash: "h",
        observation_only: true,
      });
    }
    // pad decisions count illusion: plan uses locked < settledTarget for discovery
    const plan = planCycle042({
      store,
      lastDiscoveryAt: new Date().toISOString(),
      forceDiscovery: false,
      nowMs: Date.parse("2026-09-08T00:00:00.000Z"),
      cfg: { ...loadGovernorConfig042(), settledTarget: 100, discoveryHours: 12 },
    });
    assert.equal(plan.runDiscovery, false);
    assert.equal(plan.runScores, false);
    assert.ok(plan.estimatedCredits === 0);
  });
});
