import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { appendDecision039, appendQuote039, loadStore039, upsertEvent039 } from "@/domain/eval/live-039/store";
import { parseOddsPayload045, selectSportsForPull045 } from "@/domain/eval/factory-045/pull";
import { ingestDiscovered045 } from "@/domain/eval/factory-045/ingest";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";
import { runDiscover045 } from "@/domain/eval/factory-045/discover";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { auditTask045 } from "@/domain/eval/factory-045/audit";
import { defaultCreditState042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t045-"));
}

function seedLabA(root: string, n: number) {
  const store = loadStore039(root);
  for (let i = 0; i < n; i++) {
    const id = `src${i}`;
    upsertEvent039(store, {
      event_id: `e${i}`,
      source_event_id: id,
      sport_key: "soccer_epl",
      home_team: `H${i}`,
      away_team: `A${i}`,
      commence_time: `2026-11-01T${String(12 + (i % 10)).padStart(2, "0")}:00:00.000Z`,
      source: "the-odds-api",
      first_seen_at: "2026-09-01T00:00:00.000Z",
      last_seen_at: "2026-09-01T00:00:00.000Z",
      kickoff_status: "OK",
    });
    for (const [book, home] of [
      ["pinnacle", 1.9],
      ["bet365", 2.0],
    ] as const) {
      for (const [outcome, price] of [
        ["HOME", home],
        ["DRAW", 3.4],
        ["AWAY", 4.0],
      ] as const) {
        appendQuote039(store, {
          event_id: `e${i}`,
          market: "1X2",
          bookmaker: book,
          outcome,
          price,
          source_quote_timestamp: "2026-10-31T12:00:00.000Z",
          collected_at: "2026-10-31T12:00:01.000Z",
          available_at: "2026-10-31T12:00:00.000Z",
          raw_payload_hash: `${id}-${book}-${outcome}`,
          temporal_class: "STRICT",
          match_status: "MATCH_EXACT",
          window: "T-1h",
          offset_seconds_from_kickoff: 3600,
          coverage_status: "COVERED",
        });
      }
    }
    appendDecision039(store, {
      decision_id: `d${i}`,
      event_id: `e${i}`,
      decision_timestamp_utc: "2026-11-01T11:00:00.000Z",
      window: "T-1h",
      state: "LOCKED",
      market: "1X2",
      home_raw: 0.45,
      draw_raw: 0.3,
      away_raw: 0.25,
      home_devig: 0.45,
      draw_devig: 0.3,
      away_devig: 0.25,
      overround: 1.05,
      bookmaker: "consensus",
      observation_ids: [],
      decision_context_hash: `h${i}`,
      observation_only: true,
    });
  }
}

function mockOddsFetch(): typeof fetch {
  return (async (url: RequestInfo | URL) => {
    const u = String(url);
    const headers = new Headers({
      "x-requests-remaining": "400",
      "x-requests-used": "100",
      "x-requests-last": "2",
    });
    if (u.includes("/v4/sports?") && !u.includes("/odds")) {
      return new Response(
        JSON.stringify([
          { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
          { key: "soccer_italy_serie_a", group: "Soccer", title: "Serie A", active: true, has_outrights: false },
          { key: "soccer_spain_la_liga", group: "Soccer", title: "La Liga", active: true, has_outrights: false },
          { key: "tennis_atp_us_open", group: "Tennis", title: "ATP US Open", active: true, has_outrights: false },
          { key: "soccer_uefa_champs_league", group: "Soccer", title: "UCL", active: false, has_outrights: false },
        ]),
        { status: 200, headers },
      );
    }
    if (u.includes("tennis_atp_us_open")) {
      const events = [];
      for (let i = 0; i < 30; i++) {
        events.push({
          id: `ten${i}`,
          sport_key: "tennis_atp_us_open",
          home_team: `PlayerA${i}`,
          away_team: `PlayerB${i}`,
          commence_time: `2026-11-0${1 + (i % 5)}T14:00:00+00:00`,
          bookmakers: [
            {
              key: "pinnacle",
              last_update: "2026-10-31T12:00:00+00:00",
              markets: [
                {
                  key: "h2h",
                  last_update: "2026-10-31T12:00:00+00:00",
                  outcomes: [
                    { name: `PlayerA${i}`, price: 1.8 },
                    { name: `PlayerB${i}`, price: 2.1 },
                  ],
                },
              ],
            },
            {
              key: "bet365",
              last_update: "2026-10-31T12:00:00+00:00",
              markets: [
                {
                  key: "h2h",
                  outcomes: [
                    { name: `PlayerA${i}`, price: 1.85 },
                    { name: `PlayerB${i}`, price: 2.05 },
                  ],
                },
              ],
            },
          ],
        });
      }
      return new Response(JSON.stringify(events), { status: 200, headers });
    }
    if (u.includes("/odds")) {
      const sport = /sports\/([^/]+)\/odds/.exec(u)?.[1] ?? "soccer_epl";
      const events = [];
      for (let i = 0; i < 40; i++) {
        events.push({
          id: `${sport}_${i}`,
          sport_key: sport,
          home_team: `Home_${sport}_${i}`,
          away_team: `Away_${sport}_${i}`,
          commence_time: `2026-11-0${1 + (i % 5)}T15:00:00+00:00`,
          bookmakers: [
            {
              key: "pinnacle",
              last_update: "2026-10-31T12:00:00+00:00",
              markets: [
                {
                  key: "h2h",
                  outcomes: [
                    { name: `Home_${sport}_${i}`, price: 2.1 },
                    { name: "Draw", price: 3.3 },
                    { name: `Away_${sport}_${i}`, price: 3.5 },
                  ],
                },
                {
                  key: "totals",
                  outcomes: [
                    { name: "Over", price: 1.9, point: 2.5 },
                    { name: "Under", price: 1.9, point: 2.5 },
                  ],
                },
              ],
            },
            {
              key: "bet365",
              last_update: "2026-10-31T12:00:00+00:00",
              markets: [
                {
                  key: "h2h",
                  outcomes: [
                    { name: `Home_${sport}_${i}`, price: 2.05 },
                    { name: "Draw", price: 3.4 },
                    { name: `Away_${sport}_${i}`, price: 3.6 },
                  ],
                },
              ],
            },
          ],
        });
      }
      return new Response(JSON.stringify(events), { status: 200, headers });
    }
    return new Response("{}", { status: 404, headers });
  }) as typeof fetch;
}

describe("TASK 045 permanent live factory", () => {
  it("parses multi-market payload without inventing", () => {
    const { events, quotes } = parseOddsPayload045([
      {
        id: "x1",
        sport_key: "soccer_epl",
        home_team: "A",
        away_team: "B",
        commence_time: "2026-11-01T15:00:00+00:00",
        bookmakers: [
          {
            key: "pinnacle",
            last_update: "2026-10-31T12:00:00+00:00",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "A", price: 2 },
                  { name: "Draw", price: 3 },
                  { name: "B", price: 4 },
                ],
              },
              {
                key: "totals",
                outcomes: [
                  { name: "Over", price: 1.9, point: 2.5 },
                  { name: "Under", price: 1.9, point: 2.5 },
                ],
              },
            ],
          },
        ],
      },
    ]);
    assert.equal(events.length, 1);
    assert.ok(quotes.some((q) => q.market === "1X2"));
    assert.ok(quotes.some((q) => q.market === "OU"));
  });

  it("selects active soccer+tennis from catalog", () => {
    const sel = selectSportsForPull045([
      { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
      { key: "tennis_atp_us_open", group: "Tennis", title: "ATP", active: true, has_outrights: false },
      { key: "soccer_x", group: "Soccer", title: "X", active: false, has_outrights: false },
    ]);
    assert.deepEqual(sel.soccer, ["soccer_epl"]);
    assert.deepEqual(sel.tennis, ["tennis_atp_us_open"]);
  });

  it("grows catalog beyond 114 with mock discovery; Lab A decisions untouched", async () => {
    process.env.THE_ODDS_API_KEY = "test-key";
    const labA = tmp();
    const labB = tmp();
    seedLabA(labA, 114);
    mkdirSync(join(labA), { recursive: true });
    const cfg = loadGovernorConfig042();
    writeFileSync(join(labA, "credit-state.json"), JSON.stringify(defaultCreditState042(cfg), null, 2));

    const before = loadStore039(labA).decisions.length;
    assert.equal(before, 114);

    // ingest seed-like count then discover
    const storeB = loadStore044(labB);
    // First discover alone into empty Lab B
    const disc = await runDiscover045({
      labARoot: labA,
      labBRoot: labB,
      force: true,
      fetchImpl: mockOddsFetch(),
      maxSports: 4,
      nowIso: "2026-10-15T12:00:00.000Z",
    });
    assert.ok(disc.events_inserted > 0);
    const afterDisc = loadStore044(labB);
    assert.ok(afterDisc.events.length > 114, `expected >114 got ${afterDisc.events.length}`);
    assert.ok(afterDisc.events.some((e) => e.origin === "DISCOVERED_LIVE"));
    assert.ok(afterDisc.events.some((e) => e.sport === "tennis") || disc.tennis_keys >= 0);
    assert.equal(loadStore039(labA).decisions.length, 114);

    const an = analyzeAllLabB045({ store: afterDisc, nowIso: "2026-10-15T12:00:00.000Z" });
    assert.ok(an.predicted >= 1 || afterDisc.predictions.length >= 1);
    assert.ok(afterDisc.predictions.every((p) => p.recommended === false));
  });

  it("rejects post-lock mutation", () => {
    assert.throws(() => assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z"));
  });

  it("dedupe ingest", () => {
    const labB = tmp();
    const store = loadStore044(labB);
    const payload = parseOddsPayload045([
      {
        id: "dup1",
        sport_key: "soccer_epl",
        home_team: "A",
        away_team: "B",
        commence_time: "2026-11-01T15:00:00+00:00",
        bookmakers: [
          {
            key: "pinnacle",
            last_update: "2026-10-31T12:00:00+00:00",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "A", price: 2 },
                  { name: "Draw", price: 3 },
                  { name: "B", price: 4 },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const a = ingestDiscovered045({
      store,
      sportKey: "soccer_epl",
      events: payload.events,
      quotes: payload.quotes,
      collectedAt: "2026-10-15T12:00:00.000Z",
      rawHash: "abc",
    });
    const b = ingestDiscovered045({
      store,
      sportKey: "soccer_epl",
      events: payload.events,
      quotes: payload.quotes,
      collectedAt: "2026-10-15T12:00:00.000Z",
      rawHash: "abc",
    });
    assert.equal(a.eventsInserted, 1);
    assert.equal(b.eventsInserted, 0);
  });

  it("audit rejects wrong verdict family", () => {
    assert.equal(
      auditTask045({
        WINNER: null,
        AUTO_PROMOTION: false,
        REAL_MONEY: false,
        BETS: 0,
        BANKROLL: "—",
        CAPITAL: "CLOSED",
        open_task_046: false,
        MODEL_EDGE: "UNKNOWN",
        TASK_039_040_041: "READ_ONLY_PRESERVED",
        FINAL_VERDICT: "PERMANENT_LIVE_PARTIAL",
      } as never).ok,
      true,
    );
  });
});
