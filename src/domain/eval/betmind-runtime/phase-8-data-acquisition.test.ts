import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSportsDbEvent, pickSportsDbEventForMatch, lastMatchStatsForTeam } from "@/domain/eval/data-intelligence/research/thesportsdb";
import { parseWikiTables, standingForTeam } from "@/domain/eval/data-intelligence/research/wikipedia-league";
import { eventIdentityKey, resolveTeamIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { rssItemMentionsBoth } from "@/domain/eval/data-intelligence/research/rss-news";
import { buildHumanExplanation } from "@/domain/eval/betmind-runtime/explain/italian-explanation";
import { buildResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";
import { isEligibleForIndependentModel, classifyModelInput } from "@/domain/eval/data-intelligence/research/model-input-policy";
import { parseEspnScoreboard, pickEspnEventForMatch } from "@/domain/eval/data-intelligence/research/espn-scoreboard";
import { espnEventToPermanent } from "@/domain/eval/factory-049/discover-espn";
import { sportsDbEventToPermanent } from "@/domain/eval/factory-049/discover-thesportsdb";
import { normalizeFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/normalize";

describe("Phase 8 acquisition", () => {
  it("runtime is phase-8", () => {
    assert.match(ANALYSIS_RUNTIME_VERSION, /phase-8/);
  });

  it("parses TheSportsDB event and keeps real provider ids", () => {
    const ev = parseSportsDbEvent({
      idEvent: "2494038",
      idAPIfootball: "1557405",
      strHomeTeam: "Sunderland",
      strAwayTeam: "Arsenal",
      strTimestamp: "2026-09-12T19:00:00",
      strLeague: "English Premier League",
      strVenue: "Stadium of Light",
      strOfficial: "",
      strStatus: "NS",
    });
    assert.ok(ev);
    assert.equal(ev!.idEvent, "2494038");
    assert.equal(ev!.idAPIfootball, "1557405");
    const pev = sportsDbEventToPermanent(ev!, "2026-09-11T00:00:00.000Z");
    assert.ok(pev);
    assert.equal(pev!.source, "thesportsdb");
    assert.equal(pev!.source_event_id, "2494038");
    assert.equal(pev!.fixture_id, 1557405);
    assert.equal(pev!.home_or_a, "Sunderland");
  });

  it("does not invent a match from a different pair", () => {
    const hit = pickSportsDbEventForMatch(
      [
        {
          idEvent: "1",
          idAPIfootball: "9",
          strHomeTeam: "Arsenal",
          strAwayTeam: "Chelsea",
          strTimestamp: "2026-09-06T15:30:00",
          dateEvent: "2026-09-06",
          strTime: null,
          strLeague: "English Premier League",
          idLeague: "4328",
          strVenue: "Emirates",
          strOfficial: null,
          strStatus: "FT",
          strCountry: "England",
          intHomeScore: "2",
          intAwayScore: "1",
          idHomeTeam: "133604",
          idAwayTeam: "133610",
          strSeason: "2026-2027",
        },
      ],
      "Sunderland",
      "Arsenal",
      "2026-09-12T19:00:00.000Z",
    );
    assert.equal(hit, null);
  });

  it("last-match GF is DATE_ONLY and team-specific", () => {
    const stats = lastMatchStatsForTeam("Arsenal", {
      idEvent: "2494022",
      idAPIfootball: "1557387",
      strHomeTeam: "Arsenal",
      strAwayTeam: "Chelsea",
      strTimestamp: "2026-09-06T15:30:00",
      dateEvent: "2026-09-06",
      strTime: null,
      strLeague: "English Premier League",
      idLeague: "4328",
      strVenue: null,
      strOfficial: null,
      strStatus: "FT",
      strCountry: "England",
      intHomeScore: "2",
      intAwayScore: "1",
      idHomeTeam: "133604",
      idAwayTeam: "133610",
      strSeason: "2026-2027",
    });
    assert.deepEqual(stats, { gf: 2, ga: 1, was_home: true });
  });

  it("Wikipedia standings parse without inventing ranks", () => {
    const html = `<table class="wikitable">
      <tr><th>Pos</th><th>Team</th><th>Pld</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
      <tr><td>1</td><td>Arsenal</td><td>3</td><td>3</td><td>0</td><td>0</td><td>6</td><td>1</td><td>+5</td><td>9</td></tr>
    </table>
    <table class="wikitable">
      <tr><th>Team</th><th>Location</th><th>Stadium</th><th>Capacity</th></tr>
      <tr><td>Arsenal</td><td>London</td><td>Emirates Stadium</td><td>60,704</td></tr>
    </table>`;
    const { standings, stadiums } = parseWikiTables(html);
    assert.equal(standings.length, 1);
    assert.equal(standings[0]!.team, "Arsenal");
    assert.equal(standings[0]!.pts, 9);
    assert.equal(standings[0]!.gf, 6);
    assert.ok(standingForTeam(standings, "Arsenal"));
    assert.equal(standingForTeam(standings, "Chelsea"), null);
    assert.equal(stadiums.length, 1);
    assert.equal(stadiums[0]!.stadium, "Emirates Stadium");
    assert.equal(stadiums[0]!.capacity, 60704);
  });

  it("identity key unifies aliases on the same day", () => {
    const a = eventIdentityKey({ home: "Man Utd", away: "Chelsea", kickoff: "2026-09-12T14:00:00.000Z" });
    const b = eventIdentityKey({
      home: "Manchester United",
      away: "Chelsea",
      kickoff: "2026-09-12T14:00:00.000Z",
    });
    assert.equal(a, b);
    assert.equal(resolveTeamIdentity("Hull City").canonical_id, resolveTeamIdentity("Hull").canonical_id);
  });

  it("RSS still requires both teams", () => {
    assert.equal(
      rssItemMentionsBoth("Sunderland host Arsenal at the Stadium of Light", "Sunderland", "Arsenal"),
      true,
    );
    assert.equal(rssItemMentionsBoth("Arsenal win again", "Sunderland", "Arsenal"), false);
  });

  it("TheSportsDB context does not enter independent model", () => {
    assert.equal(
      isEligibleForIndependentModel(classifyModelInput({ kind: "CONTEXT", source: "thesportsdb" })),
      false,
    );
    assert.equal(
      isEligibleForIndependentModel(classifyModelInput({ kind: "MARKET", source: "the-odds-api" })),
      false,
    );
    assert.equal(
      isEligibleForIndependentModel(classifyModelInput({ kind: "EVENT_RESEARCH", source: "espn" })),
      false,
    );
  });

  it("ESPN scoreboard parse keeps real ids and rejects the wrong pair", () => {
    const json = {
      leagues: [{ name: "English Premier League" }],
      events: [
        {
          id: "401879285",
          date: "2026-09-12T14:00Z",
          status: { type: { state: "pre", completed: false } },
          competitions: [
            {
              venue: { fullName: "Vitality Stadium", address: { city: "Bournemouth" } },
              competitors: [
                {
                  homeAway: "home",
                  form: "WDDLD",
                  team: { id: "349", displayName: "AFC Bournemouth" },
                  records: [{ type: "total", summary: "0-2-1" }],
                },
                {
                  homeAway: "away",
                  form: "LWDLW",
                  team: { id: "337", displayName: "Brentford" },
                },
              ],
            },
          ],
        },
      ],
    };
    const events = parseEspnScoreboard({
      json,
      slug: "eng.1",
      competition: "English Premier League",
      country: "England",
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]!.espn_event_id, "401879285");
    assert.equal(events[0]!.home, "AFC Bournemouth");
    assert.equal(pickEspnEventForMatch(events, "Sunderland", "Arsenal", "2026-09-12T19:00:00.000Z"), null);
    const hit = pickEspnEventForMatch(events, "Bournemouth", "Brentford", "2026-09-12T14:00:00.000Z");
    assert.ok(hit);
    const pev = espnEventToPermanent(hit!, "2026-09-11T00:00:00.000Z");
    assert.equal(pev.source, "espn");
    assert.equal(pev.source_event_id, "401879285");
    assert.equal(pev.espn_event_id, "401879285");
  });

  it("Football-Data HxG is parsed and is not an odds column", () => {
    const csv =
      "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HxG,AxG,B365H,B365D,B365A\n" +
      "E0,21/08/2026,20:00,Arsenal,Coventry,3,0,H,1.88,0.41,1.4,4.5,8.0\n";
    const { matches } = normalizeFootballDataCsv({ csvText: csv, season: "2627", league: "E0" });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.hxg, 1.88);
    assert.equal(matches[0]!.axg, 0.41);
    assert.ok(matches[0]!.odds_open.B365.home != null);
  });

  it("Italian explanation uses observation sentences and separate market", () => {
    const summary = buildResearchSummary({
      home: "Sunderland",
      away: "Arsenal",
      features: [
        { name: "home_gf_l5", value: 1.2, source: "football-data-co-uk", status: "ELIGIBLE", entered_model: true },
      ],
      research: [
        {
          source_id: "football-data-co-uk",
          ok: true,
          fetched: true,
          phase: "OK",
          parser_status: "OK",
          fields_extracted: ["home_gf_l5"],
        },
      ],
      prediction_time: "2026-09-11T00:00:00Z",
      model_version: "INDEPENDENT_POISSON_v1",
      feature_coverage: 0.5,
      has_independent_inference: true,
    });
    const hx = buildHumanExplanation({
      home: "Sunderland",
      away: "Arsenal",
      probability: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      summary,
      observations: [
        {
          event_id: "e",
          feature_key: "home_gf_l5",
          value: 1.2,
          source: "football-data-co-uk",
          source_url: null,
          observed_at: "2026-09-11T00:00:00Z",
          available_at: null,
          extraction_method: "pi",
          confidence: null,
          status: "REAL",
          kind: "HISTORICAL_PRIOR",
          enters_independent_model: true,
        },
      ],
    });
    assert.match(hx.did, /BetMind ha analizzato/);
    assert.match(hx.found_sentence, /Ha trovato/);
    assert.match(hx.used_sentence, /Ha utilizzato/);
    assert.match(hx.odds_sentence, /mercato è stato osservato separatamente/i);
    assert.equal(hx.model_card.odds_used, false);
  });
});
