import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLUBELO_FIXTURE_CSV } from "@/providers/clubelo/adapter";
import { runAcquisitionEngineCycle, runAcquisitionJob } from "@/domain/eval/acquisition-engine/engine";
import { discoverFreeSourceJobs, FREE_SOURCE_CATALOG, BLOCKED_PROTECTED_SOURCES, OPENLIGA_LEAGUES, THESPORTSDB_LEAGUES, FDOUK_DIVISIONS, ESPN_SCOREBOARDS, OPENFOOTBALL_PACKS } from "@/domain/eval/acquisition-engine/catalog";
import { discoverEngineJobs } from "@/domain/eval/acquisition-engine/jobs";
import { blockedProtectedAudit } from "@/domain/eval/acquisition-engine/blocked-audit";
import { firstClassSourceIds } from "@/domain/eval/acquisition-engine/first-class";
import { ACTIVE_FONTI_SOURCE_IDS, PRUNED_FONTI_SOURCE_IDS, isActiveFontiSource } from "@/domain/eval/acquisition-engine/active-fonti";
import { isBlockedEngineSource } from "@/domain/eval/acquisition-engine/sources/blocked";
import { isPolicyEngineSource } from "@/domain/eval/acquisition-engine/sources/policy";
import { parseUnderstatEngineMatches } from "@/domain/eval/acquisition-engine/sources/understat";
import { countClubFootballRows } from "@/domain/eval/acquisition-engine/sources/club-football-match-data";
import { parseOpenLigaMatches } from "@/domain/eval/acquisition-engine/sources/openligadb";
import { parseTheSportsDbEvents } from "@/domain/eval/acquisition-engine/sources/thesportsdb";
import { parseStatsBombCompetitions } from "@/domain/eval/acquisition-engine/sources/statsbomb";
import { countResultRows } from "@/domain/eval/acquisition-engine/sources/football-data-co-uk";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import { parseOpenFootballPack } from "@/domain/eval/acquisition-engine/sources/openfootball";
import { parseOddsApiEvents } from "@/domain/eval/acquisition-engine/sources/odds-api";
import { parseApiFootballOdds } from "@/domain/eval/acquisition-engine/sources/api-football";
import { pickUniqueTeam } from "@/domain/eval/data-intelligence/research/identity-match";
import { catalogueById, RESEARCH_SOURCE_CATALOGUE } from "@/domain/eval/data-intelligence/research/source-catalogue";
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

const ESPN_FIXTURE = JSON.stringify({
  events: [
    {
      id: "espn-1",
      date: "2026-09-12T14:00:00Z",
      name: "Liverpool vs Chelsea",
      competitions: [
        {
          competitors: [
            { homeAway: "home", team: { displayName: "Liverpool" } },
            { homeAway: "away", team: { displayName: "Chelsea" } },
          ],
          status: { type: { completed: false } },
        },
      ],
    },
  ],
});

const OPENFOOTBALL_FIXTURE = JSON.stringify({
  name: "English Premier League 2025/26",
  matches: [
    { round: "Matchday 1", date: "2025-08-15", team1: "Liverpool", team2: "Bournemouth" },
    { round: "Matchday 1", date: "2025-08-16", team1: "Arsenal", team2: "Wolves" },
  ],
});

const UNDERSTAT_FIXTURE = JSON.stringify({
  dates: [
    {
      id: "u-prior",
      datetime: "2026-09-01 15:00:00",
      h: { title: "Liverpool", id: "1" },
      a: { title: "Bournemouth", id: "2" },
      xG: { h: 1.8, a: 0.6 },
      isResult: true,
    },
    {
      id: "u-prior-2",
      datetime: "2026-09-06 15:00:00",
      h: { title: "Chelsea", id: "3" },
      a: { title: "Liverpool", id: "1" },
      xG: { h: 0.9, a: 1.4 },
      isResult: true,
    },
  ],
});

const OPEN_METEO_FIXTURE = JSON.stringify({
  current_weather: { temperature: 14.2 },
  hourly: {
    time: ["2026-09-13T14:00"],
    temperature_2m: [14.2],
    precipitation: [0],
    windspeed_10m: [8],
  },
});

const CLUB_FOOTBALL_FIXTURE = `Date,Home,Away,HomeGoals,AwayGoals,OddHome,OddDraw,OddAway
01/09/2026,Liverpool,Bournemouth,2,0,1.40,4.50,8.00
06/09/2026,Chelsea,Liverpool,1,2,2.10,3.40,3.50
`;

const ODDS_API_FIXTURE = JSON.stringify([
  {
    id: "odd-1",
    home_team: "Liverpool",
    away_team: "Chelsea",
    commence_time: "2026-09-13T14:00:00Z",
    bookmakers: [
      {
        key: "pinnacle",
        title: "Pinnacle",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Liverpool", price: 1.85 },
              { name: "Draw", price: 3.6 },
              { name: "Chelsea", price: 4.2 },
            ],
          },
        ],
      },
    ],
  },
]);

function tmpCwd(): string {
  return mkdtempSync(join(tmpdir(), "acq-engine-"));
}

const CYCLE_FIXTURES = {
  clubeloCsv: CLUBELO_FIXTURE_CSV,
  openligaJson: OPENLIGA_FIXTURE,
  theSportsDbJson: THESPORTSDB_FIXTURE,
  statsbombJson: STATSBOMB_FIXTURE,
  footballDataCoUkCsv: FDOUK_FIXTURE,
  rssXml: RSS_FIXTURE,
  espnJson: ESPN_FIXTURE,
  openFootballJson: OPENFOOTBALL_FIXTURE,
  understatJson: UNDERSTAT_FIXTURE,
  openMeteoJson: OPEN_METEO_FIXTURE,
  clubFootballCsv: CLUB_FOOTBALL_FIXTURE,
};

describe("always-on free acquisition engine", () => {
  const prevToken = process.env.FOOTBALL_DATA_ORG_TOKEN;
  const prevSports = process.env.API_SPORTS_KEY;
  const prevFootball = process.env.API_FOOTBALL_KEY;
  const prevOdds = process.env.THE_ODDS_API_KEY;
  process.env.FOOTBALL_DATA_ORG_TOKEN = "";
  delete process.env.API_SPORTS_KEY;
  delete process.env.API_FOOTBALL_KEY;
  delete process.env.THE_ODDS_API_KEY;
  after(() => {
    if (prevToken === undefined) delete process.env.FOOTBALL_DATA_ORG_TOKEN;
    else process.env.FOOTBALL_DATA_ORG_TOKEN = prevToken;
    if (prevSports === undefined) delete process.env.API_SPORTS_KEY;
    else process.env.API_SPORTS_KEY = prevSports;
    if (prevFootball === undefined) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = prevFootball;
    if (prevOdds === undefined) delete process.env.THE_ODDS_API_KEY;
    else process.env.THE_ODDS_API_KEY = prevOdds;
  });
  it("discovers allowlisted free URLs only", () => {
    const jobs = discoverFreeSourceJobs("2026-09-11T12:00:00.000Z");
    const ids = jobs.map((j) => j.source_id);
    assert.ok(ids.includes("clubelo"));
    assert.ok(ids.includes("openligadb"));
    assert.ok(ids.includes("thesportsdb"));
    assert.ok(ids.includes("statsbomb"));
    assert.ok(ids.includes("espn"));
    assert.ok(ids.includes("openfootball"));
    assert.ok(ids.includes("bbc-sport"));
    assert.ok(ids.includes("guardian-football"));
    assert.ok(ids.includes("gazzetta"));
    assert.ok(ids.includes("sky-sports"));
    assert.ok(ids.includes("espn-soccer-news"));
    assert.ok(ids.includes("corriere-sport"));
    assert.ok(ids.includes("tuttosport"));
    assert.ok(ids.includes("understat"));
    assert.ok(ids.includes("open-meteo"));
    assert.ok(ids.includes("club-football-match-data"));
    assert.equal(ids.includes("api-football"), false);
    assert.equal(ids.includes("the-odds-api"), false);
    assert.equal(ids.includes("api-sports"), false);
    assert.equal(ids.includes("football-data-org"), false);
    assert.equal(ids.includes("sky-sport"), false);
    assert.equal(ids.includes("tennis-abstract"), false);
    assert.equal(jobs.some((j) => /sofascore|fbref|whoscored/i.test(j.url)), false);
    assert.match(jobs.find((j) => j.source_id === "clubelo")!.url, /api\.clubelo\.com\/2026-09-11/);
    assert.ok(OPENLIGA_LEAGUES.length >= 9);
    assert.ok(THESPORTSDB_LEAGUES.length >= 5);
    assert.ok(FDOUK_DIVISIONS.some((d) => d.code === "B1"));
    assert.ok(FDOUK_DIVISIONS.some((d) => d.code === "T1"));
    assert.ok(FDOUK_DIVISIONS.some((d) => d.code === "G1"));
    assert.ok(ESPN_SCOREBOARDS.some((b) => b.slug === "uefa.champions"));
    assert.ok(ESPN_SCOREBOARDS.some((b) => b.slug === "ita.1"));
    assert.ok(OPENFOOTBALL_PACKS.length >= 9);
  });

  it("parses ClubElo + OpenLigaDB + TheSportsDB + StatsBomb fixtures continue-on-fail", async () => {
    const cwd = tmpCwd();
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      fixtures: CYCLE_FIXTURES,
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
    assert.equal(byId["bbc-sport"].ok, true);
    assert.equal(byId["guardian-football"].ok, true);
    assert.equal(byId.gazzetta.ok, true);
    assert.equal(byId.espn.ok, true);
    assert.equal(byId.openfootball.ok, true);
    assert.equal(byId.openfootball.records[0]?.feature_status, "NOT_ELIGIBLE");
    assert.equal(byId["football-data-org"], undefined);
    assert.equal(byId["api-football"], undefined);
    assert.equal(byId["the-odds-api"], undefined);
    assert.equal(byId["api-sports"], undefined);

    assert.equal(byId.understat.ok, true);
    assert.equal(byId.understat.records.find((r) => r.feature_key === "understat_matches_parsed")?.feature_status, "NOT_ELIGIBLE");
    assert.equal(byId.understat.records.every((r) => r.enters_independent_model === false), true);
    assert.equal(byId["open-meteo"].ok, true);
    assert.equal(byId["sky-sports"].ok, true);
    assert.equal(byId["espn-soccer-news"].ok, true);
    assert.equal(byId["corriere-sport"].ok, true);
    assert.equal(byId.tuttosport.ok, true);
    assert.equal(byId["club-football-match-data"].ok, true);
    assert.match(byId["club-football-match-data"].reason, /odds_columns_ignored/);
    assert.equal(byId.sofascore, undefined);
    assert.equal(byId.fbref, undefined);
    assert.equal(byId.whoscored, undefined);
    assert.equal(byId.opta, undefined);
    assert.equal(byId.oddspedia, undefined);

    assert.ok(result.sources_ok >= 8);
    assert.ok(result.coverage.sources_ok.includes("espn"));
    assert.equal(result.coverage.sources_auth_required.includes("football-data-org"), false);
    assert.ok(result.lanes.every((l) => l.records.every((r) => r.enters_independent_model === false)));
    assert.equal(FREE_SOURCE_CATALOG.some((s) => /mock/i.test(s.source_id)), false);
  });

  it("fail-closed identity does not bind Villa", async () => {
    const cwd = tmpCwd();
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      fixtures: CYCLE_FIXTURES,
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
        ...CYCLE_FIXTURES,
        openligaJson: undefined,
        theSportsDbJson: undefined,
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
        ...CYCLE_FIXTURES,
        openligaJson: undefined,
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
    for (const id of ["openligadb", "thesportsdb", "statsbomb", "espn", "openfootball", "bbc-sport", "understat", "open-meteo", "sky-sports"]) {
      const cat = catalogueById(id);
      assert.ok(cat, id);
      assert.notEqual(cat!.adapter, "MISSING_ADAPTER");
      assert.ok(isActiveFontiSource(id));
    }
    assert.equal(catalogueById("clubelo"), undefined);
    assert.equal(catalogueById("the-odds-api"), undefined);
    assert.equal(catalogueById("tennis-abstract"), undefined);
    assert.ok(FREE_SOURCE_CATALOG.every((s) => s.license_class !== "unknown"));
    assert.ok(FREE_SOURCE_CATALOG.every((s) => !/mock/i.test(s.source_id)));
    assert.equal(parseOpenLigaMatches(OPENLIGA_FIXTURE).length, 2);
    assert.equal(parseTheSportsDbEvents(THESPORTSDB_FIXTURE).length, 1);
    assert.equal(parseStatsBombCompetitions(STATSBOMB_FIXTURE).length, 2);
    assert.equal(parseEspnScoreboard(ESPN_FIXTURE, "eng.1").length, 1);
    assert.equal(parseOpenFootballPack(OPENFOOTBALL_FIXTURE).matches.length, 2);
  });

  it("parses The Odds API 1X2 as market-only and never invents a missing leg", () => {
    const events = parseOddsApiEvents(JSON.parse(ODDS_API_FIXTURE));
    assert.equal(events.length, 1);
    assert.equal(events[0]?.homePrice, 1.85);
    assert.equal(events[0]?.drawPrice, 3.6);
    assert.equal(events[0]?.awayPrice, 4.2);
    const incomplete = parseOddsApiEvents([{ home_team: "A", away_team: "B", bookmakers: [] }]);
    assert.equal(incomplete[0]?.homePrice ?? null, null);
    const af = parseApiFootballOdds({
      response: [
        {
          fixture: { id: 1 },
          bookmakers: [
            {
              name: "Bwin",
              bets: [
                {
                  name: "Match Winner",
                  values: [
                    { value: "Home", odd: "2.10" },
                    { value: "Draw", odd: "3.20" },
                    { value: "Away", odd: "3.50" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(af[0]?.homePrice, 2.1);
    assert.equal(af[0]?.bookmaker, "Bwin");
  });

  it("attaches football-data.co.uk Bet365 1X2 as MARKET records, not model features", async () => {
    const cwd = tmpCwd();
    const labBRoot = join(cwd, "lab-b");
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd,
      persistNeon: false,
      persistLabB: true,
      labBRoot,
      fixtures: CYCLE_FIXTURES,
      fetchImpl: async () => new Response("no", { status: 401 }),
      labEvents: [
        {
          event_id: "e-liv-bou",
          home: "Liverpool",
          away: "Bournemouth",
          kickoff_utc: "2025-08-09T14:00:00.000Z",
        },
      ],
    });
    const fd = result.lanes.find((l) => l.source_id === "football-data-co-uk")!;
    const market = fd.records.find((r) => r.feature_key === "fdouk_event_market_1x2");
    assert.ok(market);
    assert.equal(market!.enters_independent_model, false);
    assert.equal(market!.kind, "market");
    assert.equal(market!.value, 1.4);
    assert.match(fd.reason, /odds_columns_ignored/);
    const quotesPath = join(labBRoot, "quotes.jsonl");
    assert.equal(existsSync(quotesPath), true);
    const quotes = readFileSync(quotesPath, "utf8");
    assert.match(quotes, /"selection":"HOME"/);
    assert.match(quotes, /"price":1\.4/);
    assert.match(quotes, /e-liv-bou/);
  });

  it("covers every first-class catalog slug with an adapter (never UNKNOWN_SOURCE)", async () => {
    const ids = firstClassSourceIds();
    assert.ok(ids.includes("understat"));
    assert.ok(ids.includes("sky-sports"));
    assert.equal(ids.includes("diretta"), false);
    assert.equal(ids.includes("tennisstats"), false);
    assert.equal(ids.includes("tennis-abstract"), false);
    const jobs = discoverEngineJobs("2026-09-11T12:00:00.000Z");
    const jobIds = new Set(jobs.map((j) => j.source_id));
    for (const id of ids) {
      assert.ok(jobIds.has(id), `discoverEngineJobs missing ${id}`);
    }
    let fetches = 0;
    for (const id of ids) {
      const job = jobs.find((j) => j.source_id === id)!;
      const lane = await runAcquisitionJob(job, {
        nowIso: "2026-09-11T12:00:00.000Z",
        cwd: tmpCwd(),
        persistNeon: false,
        fixtures: CYCLE_FIXTURES,
        fetchImpl: async () => {
          fetches += 1;
          return new Response("no", { status: 401 });
        },
      });
      assert.notEqual(lane.reason, "UNKNOWN_SOURCE", id);
      assert.notEqual(lane.status, "SKIPPED", id);
      if (isBlockedEngineSource(id)) {
        assert.equal(lane.status, "BLOCKED", id);
        assert.equal(lane.fetched, false, id);
      }
      if (isPolicyEngineSource(id)) {
        assert.ok(lane.status === "NO_DATA" || lane.status === "AUTH_REQUIRED", id);
        assert.equal(lane.fetched, false, id);
      }
    }
    assert.equal(fetches, 0, "fixture lanes must not hit the network in this test");
  });

  it("active Fonti has zero missing adapters and no pruned stubs", () => {
    assert.equal(RESEARCH_SOURCE_CATALOGUE.filter((s) => s.adapter === "MISSING_ADAPTER").length, 0);
    assert.equal(RESEARCH_SOURCE_CATALOGUE.filter((s) => s.adapter === "POLICY_DENIED").length, 0);
    assert.ok(ACTIVE_FONTI_SOURCE_IDS.length >= 10);
    assert.ok(ACTIVE_FONTI_SOURCE_IDS.length <= 20);
    for (const s of RESEARCH_SOURCE_CATALOGUE) {
      assert.ok(isActiveFontiSource(s.source_id), s.source_id);
    }
    const jobs = discoverEngineJobs("2026-09-11T12:00:00.000Z");
    for (const id of PRUNED_FONTI_SOURCE_IDS) {
      assert.equal(jobs.some((j) => j.source_id === id), false, id);
      assert.equal(catalogueById(id), undefined, id);
    }
  });

  it("token lanes stay AUTH_REQUIRED when keys are absent — still callable, not Fonti", async () => {
    const org = await runAcquisitionJob(
      { source_id: "football-data-org", kind: "fixtures", url: "https://api.football-data.org/v4/matches", label: "org" },
      { nowIso: "2026-09-11T12:00:00.000Z", cwd: tmpCwd(), persistNeon: false, fetchImpl: async () => new Response("no", { status: 401 }) },
    );
    assert.equal(org.status, "AUTH_REQUIRED");
    const odds = await runAcquisitionJob(
      { source_id: "the-odds-api", kind: "market", url: "https://api.the-odds-api.com/v4/sports/soccer_epl/odds", label: "odds" },
      { nowIso: "2026-09-11T12:00:00.000Z", cwd: tmpCwd(), persistNeon: false, fetchImpl: async () => new Response("no", { status: 401 }) },
    );
    assert.equal(odds.status, "AUTH_REQUIRED");
  });

  it("blocked adapters never fetch SofaScore/FBref/WhoScored", async () => {
    let calls = 0;
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd: tmpCwd(),
      persistNeon: false,
      fixtures: CYCLE_FIXTURES,
      fetchImpl: async (url) => {
        calls += 1;
        if (/sofascore|fbref|whoscored/i.test(String(url))) {
          throw new Error("must not fetch protected hosts");
        }
        return new Response("no", { status: 401 });
      },
    });
    for (const id of ["sofascore", "fbref", "whoscored", "directa", "diretta", "tennis-abstract"]) {
      const lane = result.lanes.find((l) => l.source_id === id);
      assert.equal(lane, undefined, id);
    }
    const audit = blockedProtectedAudit();
    assert.equal(audit.length, 3);
    assert.equal(parseUnderstatEngineMatches(UNDERSTAT_FIXTURE).length, 2);
    assert.equal(countClubFootballRows(CLUB_FOOTBALL_FIXTURE).odds_columns_ignored >= 3, true);
    void calls;
  });

  it("ClubElo failover stays NO_DATA when every attempt fails — never invents Elo", async () => {
    const result = await runAcquisitionEngineCycle({
      nowIso: "2026-09-11T12:00:00.000Z",
      cwd: tmpCwd(),
      persistNeon: false,
      maxRetries: 1,
      fixtures: { ...CYCLE_FIXTURES, clubeloCsv: undefined },
      fetchImpl: async () => new Response("down", { status: 503 }),
    });
    const clubelo = result.lanes.find((l) => l.source_id === "clubelo")!;
    assert.equal(clubelo.ok, false);
    assert.ok(clubelo.status === "NETWORK_ERROR" || clubelo.status === "NO_DATA");
    assert.equal(clubelo.records.some((r) => r.feature_key === "home_elo" && typeof r.value === "number"), false);
    assert.match(clubelo.reason_it, /inventato/i);
  });
});
