import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { candidateToPermanentHarness } from "./mega-pipeline-test-helpers";

test("mega prediction market settlement rules", async () => {
  const { settleMarketForTest } = await import("./mega-pipeline-test-helpers");
  assert.equal(settleMarketForTest("1X2", "HOME", 2, 1), "WON");
  assert.equal(settleMarketForTest("1X2", "AWAY", 2, 1), "LOST");
  assert.equal(settleMarketForTest("BTTS", "YES", 1, 1), "WON");
  assert.equal(settleMarketForTest("BTTS", "YES", 2, 0), "LOST");
  assert.equal(settleMarketForTest("OVER_2.5", "OVER", 2, 1), "WON");
  assert.equal(settleMarketForTest("UNDER_2.5", "UNDER", 1, 0), "WON");
  assert.equal(settleMarketForTest("OU 1.5", "OVER 1.5", 1, 1), "WON");
  assert.equal(settleMarketForTest("DNB", "HOME", 1, 1), "PUSH");
});

test("free discover fixture → permanent event identity", () => {
  const pev = candidateToPermanentHarness({
    source: "openligadb",
    source_event_id: "83180",
    sport: "football",
    competition: "1. Bundesliga",
    home: "FC Bayern München",
    away: "Borussia Dortmund",
    kickoff_utc: "2026-09-11T18:30:00.000Z",
    kickoff_precision: "exact",
    finished: false,
    home_score: null,
    away_score: null,
    live: false,
    minute: null,
    source_url: "https://api.openligadb.de/getmatchdata/bl1",
  });
  assert.ok(pev);
  assert.match(pev!.event_id, /^mega_/);
  assert.equal(pev!.semantic_level, "STRICT");
  assert.equal(pev!.origin, "DISCOVERED_LIVE");
  assert.ok(pev!.canonical_event_id.length >= 16);
});

test("self-test scrape lane is permanently on", async () => {
  const { isTestScrapeEnabled } = await import("@/domain/sources/scraping-policy");
  assert.equal(isTestScrapeEnabled(), true);
  assert.equal(isTestScrapeEnabled({ ...process.env, BETMIND_TEST_SCRAPE: "0" }), true);
});

test("prediction cases disk roundtrip", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bm-mega-"));
  process.env.BETMIND_STORE_ROOT = dir;
  try {
    const { loadPredictionCases, savePredictionCases } = await import(
      "@/domain/eval/mega-pipeline/prediction-cases"
    );
    savePredictionCases(
      [
        {
          prediction_id: "p1",
          event_id: "e1",
          market: "1X2",
          selection: "HOME",
          prediction_probability: 0.55,
          odds_at_prediction: 2.1,
          model_version: "TEST_v1",
          prediction_timestamp: "2026-09-11T12:00:00.000Z",
          as_of: "2026-09-11T12:00:00.000Z",
          status: "OPEN",
          result: null,
          settled_at: null,
          pnl_simulated: null,
          data_quality: 0.7,
        },
      ],
      dir,
    );
    const loaded = loadPredictionCases(dir);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]!.status, "OPEN");
  } finally {
    delete process.env.BETMIND_STORE_ROOT;
    rmSync(dir, { recursive: true, force: true });
  }
});
