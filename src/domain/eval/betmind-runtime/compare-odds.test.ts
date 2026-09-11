import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  compareMarketProbability,
  compareOddsLayer,
  indexLatestCompleteBook1x2,
  latestCompleteBook1x2,
} from "@/domain/eval/betmind-runtime/compare-odds";
import { listCalendarEvents } from "@/domain/eval/betmind-runtime/calendar";
import { buildLiteNextEvents } from "@/domain/eval/betmind-runtime/board";
import {
  attachCachedCompareBook,
  loadCachedMarketCandidates,
  probeCachedOddsAttach,
  summarizeMarketAttach,
} from "@/domain/eval/betmind-runtime/market-attach";
import { parseFdoukDate } from "@/domain/eval/acquisition-engine/sources/football-data-co-uk";
import { parseApiFootballOdds } from "@/domain/eval/acquisition-engine/sources/api-football";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";

function q(over: Record<string, unknown>) {
  return {
    event_id: "e1",
    bookmaker: "pinnacle",
    market: "1X2",
    selection: "HOME",
    line: null,
    price: 2.1,
    collected_at_utc: "2026-09-11T10:00:00.000Z",
    ...over,
  };
}

describe("compare-only book 1X2", () => {
  it("returns a complete 1X2 from one bookmaker", () => {
    const book = latestCompleteBook1x2([
      q({ selection: "HOME", price: 2.2 }),
      q({ selection: "DRAW", price: 3.4 }),
      q({ selection: "AWAY", price: 3.1 }),
    ]);
    assert.ok(book);
    assert.equal(book!.bookmaker, "pinnacle");
    assert.equal(book!.odds_home, 2.2);
    assert.equal(book!.odds_draw, 3.4);
    assert.equal(book!.odds_away, 3.1);
    assert.equal(book!.odds_compare_only, true);
  });

  it("does not invent a complete 1X2 from two legs", () => {
    const book = latestCompleteBook1x2([
      q({ selection: "HOME", price: 2.2 }),
      q({ selection: "AWAY", price: 3.1 }),
    ]);
    assert.equal(book, null);
  });

  it("does not fill missing legs from another book", () => {
    const book = latestCompleteBook1x2([
      q({ bookmaker: "pinnacle", selection: "HOME", price: 2.2 }),
      q({ bookmaker: "pinnacle", selection: "DRAW", price: 3.4 }),
      q({ bookmaker: "bet365", selection: "AWAY", price: 3.0 }),
    ]);
    assert.equal(book, null);
  });

  it("does not blend two complete books — newest snapshot wins", () => {
    const book = latestCompleteBook1x2([
      q({ bookmaker: "pinnacle", selection: "HOME", price: 2.05, collected_at_utc: "2026-09-11T09:00:00.000Z" }),
      q({ bookmaker: "pinnacle", selection: "DRAW", price: 3.5, collected_at_utc: "2026-09-11T09:00:00.000Z" }),
      q({ bookmaker: "pinnacle", selection: "AWAY", price: 3.6, collected_at_utc: "2026-09-11T09:00:00.000Z" }),
      q({ bookmaker: "bet365", selection: "HOME", price: 1.9, collected_at_utc: "2026-09-11T11:00:00.000Z" }),
      q({ bookmaker: "bet365", selection: "DRAW", price: 3.6, collected_at_utc: "2026-09-11T11:00:00.000Z" }),
      q({ bookmaker: "bet365", selection: "AWAY", price: 4.0, collected_at_utc: "2026-09-11T11:00:00.000Z" }),
    ]);
    assert.equal(book?.bookmaker, "bet365");
    assert.equal(book?.odds_home, 1.9);
  });

  it("rejects prices that are not real decimal odds", () => {
    assert.equal(
      latestCompleteBook1x2([
        q({ selection: "HOME", price: 1 }),
        q({ selection: "DRAW", price: 3.4 }),
        q({ selection: "AWAY", price: 3.1 }),
      ]),
      null,
    );
  });

  it("does not convert 1/p into a fake book price", () => {
    const layer = compareOddsLayer({
      quotes: [],
      probability_market: { HOME: 0.5, DRAW: 0.25, AWAY: 0.25 },
    });
    assert.equal(layer.odds_home, null);
    assert.equal(layer.odds_draw, null);
    assert.equal(layer.odds_away, null);
    assert.equal(layer.bookmaker, null);
    assert.equal(layer.odds_market, null);
    assert.deepEqual(layer.probability_market, { HOME: 0.5, DRAW: 0.25, AWAY: 0.25 });
    assert.equal(layer.odds_compare_only, true);
  });

  it("compareMarketProbability ignores junk and stays null when empty", () => {
    assert.equal(compareMarketProbability(null), null);
    assert.equal(compareMarketProbability({ foo: 1 }), null);
    assert.deepEqual(compareMarketProbability({ HOME: 0.4, DRAW: 0.3, AWAY: 0.3 }), {
      HOME: 0.4,
      DRAW: 0.3,
      AWAY: 0.3,
    });
  });

  it("indexes per event and never mixes event ids", () => {
    const idx = indexLatestCompleteBook1x2([
      q({ event_id: "e1", selection: "HOME" }),
      q({ event_id: "e1", selection: "DRAW", price: 3.4 }),
      q({ event_id: "e1", selection: "AWAY", price: 3.1 }),
      q({ event_id: "e2", selection: "HOME", price: 1.8 }),
    ]);
    assert.ok(idx.get("e1"));
    assert.equal(idx.has("e2"), false);
  });
});

describe("calendar attaches compare-only odds without touching the model", () => {
  it("missing quotes stay null; independent probabilities stay model-only", () => {
    const root = join(tmpdir(), `odds-cal-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "events.jsonl"),
      JSON.stringify({
        event_id: "e1",
        sport: "soccer",
        competition: "EPL",
        home_or_a: "Home",
        away_or_b: "Away",
        kickoff_utc: "2026-09-12T15:00:00.000Z",
        status: "SCHEDULED",
      }) + "\n",
      "utf8",
    );
    writeFileSync(
      join(root, "predictions.jsonl"),
      JSON.stringify({
        event_id: "e1",
        timestamp: "2026-09-11T12:00:00.000Z",
        model_version: "INDEPENDENT_POISSON",
        probability_model: { HOME: 0.44, DRAW: 0.28, AWAY: 0.28 },
        probability_market: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
        reason_codes: [],
      }) + "\n",
      "utf8",
    );
    const cal = listCalendarEvents({ root, date: "2026-09-12", sport: "football" });
    assert.equal(cal.total, 1);
    const row = cal.events[0]!;
    assert.deepEqual(row.probability_model, { HOME: 0.44, DRAW: 0.28, AWAY: 0.28 });
    assert.equal(row.odds, null);
    assert.equal(row.odds_home, null);
    assert.equal(row.bookmaker, null);
    assert.equal(row.odds_compare_only, true);
    assert.deepEqual(row.probability_market, { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 });
    assert.doesNotThrow(() =>
      assertNoMarketInputsInPredictionContext(["home_gf_l5", "away_ga_l5"]),
    );
    assert.throws(() => assertNoMarketInputsInPredictionContext(["odds_home", "home_gf_l5"]));
  });

  it("attaches a real complete book 1X2 without changing probability_model", () => {
    const root = join(tmpdir(), `odds-cal2-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "events.jsonl"),
      JSON.stringify({
        event_id: "e1",
        sport: "soccer",
        competition: "EPL",
        home_or_a: "Home",
        away_or_b: "Away",
        kickoff_utc: "2026-09-12T15:00:00.000Z",
        status: "SCHEDULED",
      }) + "\n",
      "utf8",
    );
    writeFileSync(
      join(root, "predictions.jsonl"),
      JSON.stringify({
        event_id: "e1",
        timestamp: "2026-09-11T12:00:00.000Z",
        model_version: "INDEPENDENT_POISSON",
        probability_model: { HOME: 0.5, DRAW: 0.25, AWAY: 0.25 },
        reason_codes: [],
      }) + "\n",
      "utf8",
    );
    writeFileSync(
      join(root, "quotes.jsonl"),
      [
        q({ selection: "HOME", price: 2.05 }),
        q({ selection: "DRAW", price: 3.5 }),
        q({ selection: "AWAY", price: 3.6 }),
      ]
        .map((row) => JSON.stringify(row))
        .join("\n") + "\n",
      "utf8",
    );
    const cal = listCalendarEvents({ root, date: "2026-09-12", sport: "football" });
    const row = cal.events[0]!;
    assert.deepEqual(row.probability_model, { HOME: 0.5, DRAW: 0.25, AWAY: 0.25 });
    assert.equal(row.odds_home, 2.05);
    assert.equal(row.odds_draw, 3.5);
    assert.equal(row.odds_away, 3.6);
    assert.equal(row.bookmaker, "pinnacle");
    assert.equal(row.odds_market, "1X2");
    assert.equal(row.odds_compare_only, true);
    assert.equal(row.odds, null);
    assert.deepEqual(row.markets, ["1X2"]);
  });

  it("attaches football-data.co.uk Bet365 from cache when quotes.jsonl is empty", () => {
    const root = join(tmpdir(), `odds-cache-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const cwd = join(root, "cwd");
    mkdirSync(join(cwd, "data", "acquisition", "football-data-co-uk"), { recursive: true });
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(cwd, "data", "acquisition", "football-data-co-uk", "E0.csv"),
      "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A\nE0,12/09/2026,Liverpool,Chelsea,2,1,1.85,3.60,4.20\n",
      "utf8",
    );
    writeFileSync(
      join(root, "events.jsonl"),
      JSON.stringify({
        event_id: "e-liv-che",
        sport: "soccer",
        competition: "EPL",
        home_or_a: "Liverpool",
        away_or_b: "Chelsea",
        kickoff_utc: "2026-09-12T14:00:00.000Z",
        status: "SCHEDULED",
      }) + "\n",
      "utf8",
    );
    const cal = listCalendarEvents({ root, date: "2026-09-12", sport: "football", cwd });
    const row = cal.events[0]!;
    assert.equal(row.odds_home, 1.85);
    assert.equal(row.odds_draw, 3.6);
    assert.equal(row.odds_away, 4.2);
    assert.equal(row.bookmaker, "bet365");
    assert.equal(row.odds_source, "football-data-co-uk");
    assert.equal(row.odds_status, "BOOK");
    assert.equal(row.odds_compare_only, true);
    assert.equal(row.odds, null);
    const summary = summarizeMarketAttach({
      events: [{ event_id: "e-liv-che", odds_home: 1.85, odds_draw: 3.6, odds_away: 4.2 }],
    });
    assert.equal(summary.with_real_book, 1);
    assert.equal(summary.mock_sold_as_real, 0);
    const probe = probeCachedOddsAttach(cwd, 5);
    assert.ok(probe.cache_complete_books >= 1);
    assert.equal(probe.attached, probe.probed);
    assert.equal(probe.mock_sold_as_real, 0);
    assert.equal(probe.samples[0]?.odds_home, 1.85);
  });

  it("does not attach another date of the same pair", () => {
    const candidates = loadCachedMarketCandidates(
      (() => {
        const cwd = join(tmpdir(), `odds-day-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        mkdirSync(join(cwd, "data", "acquisition", "football-data-co-uk"), { recursive: true });
        writeFileSync(
          join(cwd, "data", "acquisition", "football-data-co-uk", "E0.csv"),
          "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A\nE0,01/08/2025,Liverpool,Chelsea,1,0,1.70,3.80,5.00\n",
          "utf8",
        );
        return cwd;
      })(),
    );
    const hit = attachCachedCompareBook({
      home: "Liverpool",
      away: "Chelsea",
      kickoff_utc: "2026-09-12T14:00:00.000Z",
      candidates,
    });
    assert.equal(hit, null);
  });

  it("lite board never converts 1/p into a book price and still has a quote slot", () => {
    const root = join(tmpdir(), `odds-board-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "events.jsonl"),
      JSON.stringify({
        event_id: "e1",
        sport: "soccer",
        competition: "EPL",
        home_or_a: "Home",
        away_or_b: "Away",
        kickoff_utc: "2026-09-12T15:00:00.000Z",
        status: "SCHEDULED",
      }) + "\n",
      "utf8",
    );
    writeFileSync(
      join(root, "decisions.jsonl"),
      JSON.stringify({
        event_id: "e1",
        timestamp: "2026-09-11T12:00:00.000Z",
        decision: "NO_BET",
        probability: 0.44,
        market_probability: 0.5,
      }) + "\n",
      "utf8",
    );
    const rows = buildLiteNextEvents(root, Date.parse("2026-09-11T12:00:00.000Z"), 10, root);
    const row = rows[0]!;
    assert.equal(row.odds_home, null);
    assert.equal(row.odds_draw, null);
    assert.equal(row.odds_away, null);
    assert.equal(row.odds_status, "MISSING");
    assert.equal(row.odds_compare_only, true);
    assert.notEqual(row.odds, 2);
    assert.doesNotThrow(() => assertNoMarketInputsInPredictionContext(["home_gf_l5"]));
  });
});

describe("free market parsers stay honest", () => {
  it("parses football-data.co.uk DATE_ONLY and API-Football complete 1X2 only", () => {
    assert.equal(parseFdoukDate("12/09/2026"), "2026-09-12");
    assert.equal(parseFdoukDate("9/8/25"), "2025-08-09");
    assert.equal(parseFdoukDate("not-a-date"), null);
    const books = parseApiFootballOdds({
      response: [
        {
          fixture: { id: 99 },
          bookmakers: [
            {
              name: "Bet365",
              bets: [
                {
                  name: "Match Winner",
                  values: [
                    { value: "Home", odd: "1.90" },
                    { value: "Draw", odd: "3.40" },
                    { value: "Away", odd: "4.00" },
                  ],
                },
              ],
            },
          ],
        },
        {
          fixture: { id: 100 },
          bookmakers: [
            {
              name: "Bet365",
              bets: [{ name: "Match Winner", values: [{ value: "Home", odd: "1.90" }] }],
            },
          ],
        },
      ],
    });
    assert.equal(books.length, 1);
    assert.equal(books[0]?.homePrice, 1.9);
    assert.equal(books[0]?.drawPrice, 3.4);
    assert.equal(books[0]?.awayPrice, 4);
  });
});
