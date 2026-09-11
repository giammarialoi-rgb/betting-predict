import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLUBELO_FIXTURE_CSV } from "@/providers/clubelo/adapter";
import { runAcquisitionEngineCycle } from "@/domain/eval/acquisition-engine/engine";
import { discoverFreeSourceJobs, FREE_SOURCE_CATALOG, BLOCKED_PROTECTED_SOURCES } from "@/domain/eval/acquisition-engine/catalog";
import { blockedProtectedAudit } from "@/domain/eval/acquisition-engine/blocked-audit";
import { parseOpenLigaMatches } from "@/domain/eval/acquisition-engine/sources/openligadb";
import { parseTheSportsDbEvents } from "@/domain/eval/acquisition-engine/sources/thesportsdb";
import { parseStatsBombCompetitions } from "@/domain/eval/acquisition-engine/sources/statsbomb";
import { countResultRows } from "@/domain/eval/acquisition-engine/sources/football-data-co-uk";
import { pickUniqueTeam } from "@/domain/eval/data-intelligence/research/identity-match";
import { catalogueById } from "@/domain/eval/data-intelligence/research/source-catalogue";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { isEligibleForIndependentModel, classifyModelInput } from "@/domain/eval/data-intelligence/research/model-input-policy";
import { RetryableError, PermanentError, classifyHttpStatus } from "@/ingest/retry";
import { assertScrapingDenied } from "@/domain/sources/scraping-policy";

const OPENLIGA_FIXTURE = JSON.stringify([
  {
    matchID: 9001,
    matchDateTimeUTC: "2026-09-12T16:30:00Z",
    matchIsFinished: false,
    leagueName: "1. Fußball-Bundesliga 2026/2027",
    team1: { teamName: "FC Bayern München", shortName: "Bayern" },
    team2: { teamName: "Borussia Dortmund", shortName: "BVB" },
  },
  {
    matchID: 9002,
    matchDateTimeUTC: "2026-09-12T13:30:00Z",
    matchIsFinished: true,
    leagueName: "1. Fußball-Bundesliga 2026/2027",
    team1: { teamName: "Bayer 04 Leverkusen", shortName: "Bayer 04" },
    team2: { teamName: "Eintracht Frankfurt", shortName: "Frankfurt" },
    matchResults: [{ resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 }],
  },
]);

const THESPORTSDB_FIXTURE = JSON.stringify({
  events: [
    {
      idEvent: "123",
      strHomeTeam: "Liverpool",
      strAwayTeam: "Chelsea",
      dateEvent: "2026-09-13",
      strTime: "15:00:00",
      strLeague: "English Premier League",
      strThumb: "https://example.invalid/liv-che.png",
    },
  ],
});

const STATSBOMB_FIXTURE = JSON.stringify([
  {
    competition_id: 11,
    season_id: 90,
    country_name: "Spain",
    competition_name: "La Liga",
    season_name: "2020/2021",
    match_available: "2022-12-05T14:39:27.366226",
  },
  {
    competition_id: 2,
    season_id: 44,
    country_name: "England",
    competition_name: "Premier League",
    season_name: "2015/2016",
    match_available: null,
  },
]);

const FDOUK_FIXTURE = `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A
E0,09/08/2025,Liverpool,Bournemouth,2,0,1.40,4.50,8.00
E0,09/08/2025,Arsenal,Wolves,1,0,1.55,4.20,6.50
`;

const RSS_FIXTURE = `<?xml version="1.0"?><rss><channel>
<item><title>Calcio: preview giornata</title><link>https://www.ansa.it/x</link><pubDate>Fri, 11 Sep 2026 08:00:00 GMT</pubDate><description>Anteprima</description></item>
</channel></rss>`;

function tmpCwd(): string {
  return mkdtempSync(join(tmpdir(), "acq-engine-"));
}

describe("always-on free acquisition engine", () => {
  const prevToken = process.env.FOOTBALL_DATA_ORG_TOKEN;
  process.env.FOOTBALL_DATA_ORG_TOKEN = "";
  after(() => {
    if (prevToken === undefined) delete process.env.FOOTBALL_DATA_ORG_TOKEN;
    else process.env.FOOTBALL_DATA_ORG_TOKEN = prevToken;
  });
  it("discovers allowlisted free URLs only", () => {
    const jobs = discoverFreeSourceJobs("2026-09-11T12:00:00.000Z");
    const ids = jobs.map((j) => j.source_id);
    assert.ok(ids.includes("clubelo"));
    assert.ok(ids.includes("openligadb"));
    assert.ok(ids.includes("thesportsdb"));
    assert.ok(ids.includes("statsbomb"));
    assert.equal(jobs.some((j) => /sofascore|fbref|whoscored/i.test(j.url)), false);
    assert.match(jobs.find((j) => j.source_id === "clubelo")!.url, /api\.clubelo\.com\/2026-09-11/);
  });

  it("parses ClubElo + OpenLigaDB + TheSportsDB + StatsBomb fixtures continue-on-fail", async () => {
    const cwd = tmpCwd();
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      fixtures: {
        clubeloCsv: CLUBELO_FIXTURE_CSV,
        openligaJson: OPENLIGA_FIXTURE,
        theSportsDbJson: THESPORTSDB_FIXTURE,
        statsbombJson: STATSBOMB_FIXTURE,
        footballDataCoUkCsv: FDOUK_FIXTURE,
        rssXml: RSS_FIXTURE,
      },
      fetchImpl: async () =>
        new Response("no token", { status: 401, headers: { "Content-Type": "text/plain" } }),
      labEvents: [
        {
          event_id: "e-liv-che",
          home: "Liverpool",
          away: "Chelsea",
          kickoff_utc: "2026-09-13T14:00:00.000Z",
        },
        {
          event_id: "e-bay-dor",
          home: "Bayern Munich",
          away: "Borussia Dortmund",
          kickoff_utc: "2026-09-12T16:30:00.000Z",
        },
      ],
    });

    const byId = Object.fromEntries(result.lanes.map((l) => [l.source_id, l]));
    assert.equal(byId.clubelo.ok, true);
    assert.ok((byId.clubelo.records.find((r) => r.feature_key === "clubelo_clubs_parsed")?.value as number) >= 5);
    assert.equal(byId.clubelo.records.find((r) => r.feature_key === "home_elo" && r.event_id === "e-liv-che")?.value, 2040);
    assert.ok(existsSync(join(cwd, "data", "clubelo", "2026-09-11.csv")));

    assert.equal(byId.openligadb.ok, true);
    assert.equal(byId.openligadb.records.find((r) => r.feature_key === "openligadb_matches_parsed")?.value, 2);
    const boundBl = byId.openligadb.records.find((r) => r.feature_key === "openligadb_fixture");
    assert.equal(boundBl?.event_id, "e-bay-dor");
    assert.equal(boundBl?.enters_independent_model, false);

    assert.equal(byId.thesportsdb.ok, true);
    assert.equal(byId.thesportsdb.records.find((r) => r.feature_key === "thesportsdb_events_parsed")?.value, 1);

    assert.equal(byId.statsbomb.ok, true);
    const sb = byId.statsbomb.records.find((r) => r.feature_key === "statsbomb_competitions");
    assert.equal(sb?.value, 2);
    assert.equal(sb?.feature_status, "NOT_ELIGIBLE");
    assert.equal(sb?.available_at, null);
    assert.equal(sb?.enters_independent_model, false);

    assert.equal(byId["football-data-co-uk"].ok, true);
    assert.equal(byId["football-data-co-uk"].records[0]?.temporal_precision, "date_only");
    assert.match(byId["football-data-co-uk"].reason, /odds_columns_ignored/);

    assert.equal(byId.ansa.ok, true);
    assert.equal(byId["football-data-org"].status, "AUTH_REQUIRED");
    assert.match(byId["football-data-org"].reason_it, /token gratuito/i);

    assert.ok(result.sources_ok >= 5);
    assert.ok(result.lanes.every((l) => l.records.every((r) => r.enters_independent_model === false)));
  });

  it("fail-closed identity does not bind Villa", async () => {
    const cwd = tmpCwd();
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      fixtures: {
        clubeloCsv: CLUBELO_FIXTURE_CSV,
        openligaJson: OPENLIGA_FIXTURE,
        theSportsDbJson: THESPORTSDB_FIXTURE,
        statsbombJson: STATSBOMB_FIXTURE,
        footballDataCoUkCsv: FDOUK_FIXTURE,
        rssXml: RSS_FIXTURE,
      },
      fetchImpl: async () => new Response("", { status: 401 }),
      labEvents: [
        {
          event_id: "e-villa",
          home: "Villa",
          away: "Liverpool",
          kickoff_utc: "2026-09-13T14:00:00.000Z",
        },
      ],
    });
    const clubelo = result.lanes.find((l) => l.source_id === "clubelo")!;
    assert.equal(clubelo.records.some((r) => r.feature_key === "home_elo"), false);
    const unbound = clubelo.records.find((r) => r.feature_key === "home_elo_unbound");
    assert.ok(unbound);
    assert.match(String(unbound?.identity_status), /SHORT_NAME_BLOCKED|NONE/);
    assert.equal(pickUniqueTeam("Villa", ["Aston Villa", "Villarreal"]).matched, false);
  });

  it("one 403 source does not stop the queue", async () => {
    const cwd = tmpCwd();
    let calls = 0;
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      maxRetries: 0,
      fixtures: {
        clubeloCsv: CLUBELO_FIXTURE_CSV,
        statsbombJson: STATSBOMB_FIXTURE,
        footballDataCoUkCsv: FDOUK_FIXTURE,
        rssXml: RSS_FIXTURE,
      },
      fetchImpl: async (url) => {
        calls += 1;
        const href = String(url);
        if (href.includes("openligadb") || href.includes("thesportsdb")) {
          return new Response("blocked", { status: 403 });
        }
        return new Response("no", { status: 401 });
      },
    });
    const ol = result.lanes.find((l) => l.source_id === "openligadb")!;
    const ts = result.lanes.find((l) => l.source_id === "thesportsdb")!;
    const sb = result.lanes.find((l) => l.source_id === "statsbomb")!;
    assert.equal(ol.status, "BLOCKED");
    assert.equal(ts.status, "BLOCKED");
    assert.equal(sb.ok, true);
    assert.equal(result.lanes.find((l) => l.source_id === "clubelo")!.ok, true);
    assert.ok(calls >= 1);
  });

  it("retries 429 then succeeds; 403 is permanent", async () => {
    assert.equal(classifyHttpStatus(429), "retryable");
    assert.equal(classifyHttpStatus(403), "permanent");
    const err429 = new RetryableError("HTTP_429", 429);
    const err403 = new PermanentError("HTTP_403", 403);
    assert.equal(err429.httpStatus, 429);
    assert.equal(err403.httpStatus, 403);

    let hits = 0;
    const cwd = tmpCwd();
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      maxRetries: 2,
      fixtures: {
        clubeloCsv: CLUBELO_FIXTURE_CSV,
        theSportsDbJson: THESPORTSDB_FIXTURE,
        statsbombJson: STATSBOMB_FIXTURE,
        footballDataCoUkCsv: FDOUK_FIXTURE,
        rssXml: RSS_FIXTURE,
      },
      fetchImpl: async (url) => {
        const href = String(url);
        if (href.includes("openligadb")) {
          hits += 1;
          if (hits < 2) return new Response("slow down", { status: 429 });
          return new Response(OPENLIGA_FIXTURE, { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response("no", { status: 401 });
      },
    });
    assert.equal(result.lanes.find((l) => l.source_id === "openligadb")!.ok, true);
    assert.ok(hits >= 2);
  });

  it("Italian audit for SofaScore/FBref/WhoScored — no WAF bypass", () => {
    const audit = blockedProtectedAudit();
    assert.equal(audit.length, 3);
    for (const row of audit) {
      assert.equal(row.status, "BLOCKED");
      assert.match(row.reason_it, /HTTP 403/);
      assert.match(row.reason_it, /Nessun bypass/i);
    }
    assert.equal(BLOCKED_PROTECTED_SOURCES.length, 3);
    assert.throws(() => assertScrapingDenied("bypass_waf"));
    assert.throws(() => assertScrapingDenied("bypass_captcha"));
  });

  it("odds stay out of independent model; gates unchanged", () => {
    assert.equal(isEligibleForIndependentModel(classifyModelInput({ kind: "MARKET", source: "the-odds-api" })), false);
    assert.throws(() => assertNoMarketInputsInPredictionContext(["B365H", "home_elo"]));
    const src = readFileSync(join(process.cwd(), "src/domain/eval/predictive-intelligence/predict-live.ts"), "utf8");
    assert.match(src, /missing_keys\.length > 45/);
    assert.match(src, /feature_coverage < 0\.35/);
    const counted = countResultRows(FDOUK_FIXTURE);
    assert.equal(counted.rows, 2);
    assert.ok(counted.odds_columns_ignored >= 3);
  });

  it("registers real free sources in catalogue (not mock)", () => {
    for (const id of ["clubelo", "openligadb", "thesportsdb", "statsbomb", "football-data-org"]) {
      const cat = catalogueById(id);
      assert.ok(cat, id);
      assert.notEqual(cat!.adapter, "MISSING_ADAPTER");
      assert.equal(cat!.market_layer, false);
    }
    assert.ok(FREE_SOURCE_CATALOG.every((s) => s.license_class !== "unknown"));
    assert.equal(parseOpenLigaMatches(OPENLIGA_FIXTURE).length, 2);
    assert.equal(parseTheSportsDbEvents(THESPORTSDB_FIXTURE).length, 1);
    assert.equal(parseStatsBombCompetitions(STATSBOMB_FIXTURE).length, 2);
  });
});
