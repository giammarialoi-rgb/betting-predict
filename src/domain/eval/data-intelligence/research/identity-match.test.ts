import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  identityKey,
  namesEqual,
  normalizeTeamName,
  resolveCompetitionMatrix,
} from "@/domain/eval/data-intelligence/research/identity-normalize";
import {
  assignEventSide,
  matchEventPair,
  matchTeamNames,
  pickUniqueDatedPair,
  pickUniqueTeam,
} from "@/domain/eval/data-intelligence/research/identity-match";
import { rollingPriorXg, researchUnderstatLeague, parseUnderstatLeagueJson } from "@/domain/eval/data-intelligence/research/understat-league";
import { resolveLiveTeamId } from "@/domain/eval/predictive-intelligence/live-resolve";
import { sourceFailureReasonIt } from "@/domain/eval/betmind-runtime/explain/source-status";
import { matchEventInText } from "@/domain/eval/data-intelligence/research/extract-html";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

function pi(home: string, homeId: string, away: string, awayId: string): PiMatchRow {
  return {
    canonical_id: `${homeId}-${awayId}`,
    source: "football-data-co-uk",
    season: "2526",
    league: "E0",
    match_date: "2026-08-01",
    event_time: "2026-08-01T15:00:00.000Z",
    home_team: home,
    away_team: away,
    home_team_id: homeId,
    away_team_id: awayId,
    fthg: 1,
    ftag: 0,
    ftr: "HOME",
    hthg: null,
    htag: null,
    htr: null,
    hs: null,
    as: null,
    hst: null,
    ast: null,
    hc: null,
    ac: null,
    hy: null,
    ay: null,
    hr: null,
    ar: null,
    odds_open: {
      B365: { home: 2, draw: 3, away: 4 },
      PS: { home: 2, draw: 3, away: 4 },
      Avg: { home: 2, draw: 3, away: 4 },
    },
    research_odds_close: {
      B365C: { home: 2, draw: 3, away: 4 },
      PSC: { home: 2, draw: 3, away: 4 },
    },
    label_time: "2026-08-02T00:00:00.000Z",
    result_available_at: "2026-08-02T00:00:00.000Z",
  };
}

describe("identity matching — short names fail closed", () => {
  it("does not bind Villa to Aston Villa or Villarreal", () => {
    assert.equal(namesEqual("Villa", "Aston Villa"), false);
    assert.equal(namesEqual("Villa", "Villarreal"), false);
    assert.equal(matchTeamNames("Villa", "Aston Villa").status, "SHORT_NAME_BLOCKED");
    assert.equal(pickUniqueTeam("Villa", ["Aston Villa", "Villarreal CF", "Nottingham Forest"]).matched, false);
    assert.equal(pickUniqueTeam("Villa", ["Aston Villa", "Villarreal CF"]).status, "SHORT_NAME_BLOCKED");
    assert.match(pickUniqueTeam("Villa", ["Aston Villa"]).reason_it, /ambiguo|corto/i);
  });

  it("binds Aston Villa only to Aston Villa, not Villarreal", () => {
    assert.equal(namesEqual("Aston Villa", "Aston Villa FC"), true);
    assert.equal(namesEqual("Aston Villa", "Villarreal"), false);
    const pick = pickUniqueTeam("Aston Villa", ["Aston Villa", "Villarreal", "Nottingham Forest"]);
    assert.equal(pick.matched, true);
    assert.equal(identityKey(pick.candidate ?? ""), identityKey("Aston Villa"));
  });

  it("does not attach a Villa injury label to either side", () => {
    const side = assignEventSide("Villa", "Aston Villa", "Nottingham Forest");
    assert.equal(side.side, null);
    assert.equal(side.match.matched, false);
  });
});

describe("identity matching — declared aliases vs collisions", () => {
  it("maps Odds / Understat aliases without inventing clubs", () => {
    assert.equal(namesEqual("CA Osasuna", "Osasuna"), true);
    assert.equal(namesEqual("Wolves", "Wolverhampton Wanderers"), true);
    assert.equal(namesEqual("Olympique Lyonnais", "Lyon"), true);
    assert.equal(namesEqual("Stade Rennais", "Rennes"), true);
    assert.equal(namesEqual("Hellas Verona", "Verona"), true);
    assert.equal(namesEqual("OGC Nice", "Nice"), true);
    assert.equal(namesEqual("West Ham United", "West Ham"), true);
    assert.equal(namesEqual("Man Utd", "Manchester United FC"), true);
    assert.equal(namesEqual("Bayern Munchen", "Bayern Munich"), true);
  });

  it("refuses alias collisions (Inter Miami, Sporting, Paris FC, Real)", () => {
    assert.equal(namesEqual("Inter", "Inter Miami"), false);
    assert.equal(namesEqual("Sporting", "Sporting CP"), false);
    assert.equal(namesEqual("Sporting", "Sporting Gijon"), false);
    assert.equal(namesEqual("Sporting CP", "Sporting Gijon"), false);
    assert.equal(namesEqual("Paris FC", "Paris Saint Germain"), false);
    assert.equal(namesEqual("Paris FC", "PSG"), false);
    assert.equal(namesEqual("Real", "Real Madrid"), false);
    assert.equal(namesEqual("Real", "Real Sociedad"), false);
    assert.equal(namesEqual("Real Madrid", "Real Sociedad"), false);
  });

  it("fails closed on cross-competition homonyms", () => {
    assert.equal(namesEqual("Aston Villa", "Villa Mitre"), false);
    assert.equal(namesEqual("Villa Mitre", "Villarreal"), false);
    assert.equal(matchEventPair("Aston Villa", "Nottingham Forest", "Villa Mitre", "Nottingham Forest").matched, false);
    const html = matchEventInText("Villa Mitre beat someone in Argentina", "Aston Villa", "Nottingham Forest");
    assert.notEqual(html, "EVENT_MATCHED");
  });
});

describe("identity matching — competition keys", () => {
  it("does not map a bare 'league' substring to EPL", () => {
    const bare = resolveCompetitionMatrix("league");
    assert.equal(bare.canonical_code, null);
    assert.equal(bare.understat_slug, null);
    assert.equal(bare.confidence, "PROVISIONAL");
  });

  it("keeps exact top-league keys", () => {
    assert.equal(resolveCompetitionMatrix("soccer_epl").understat_slug, "EPL");
    assert.equal(resolveCompetitionMatrix("Serie A").canonical_code, "I1");
    assert.equal(resolveCompetitionMatrix("La Liga").understat_slug, "La_liga");
    assert.equal(resolveCompetitionMatrix("made up cup 2099").canonical_code, null);
  });
});

describe("identity matching — live resolve no slug_contains", () => {
  it("does not bind Villa onto villarreal or aston-villa via substring", () => {
    const matches = [
      pi("Aston Villa", "aston-villa", "Arsenal", "arsenal"),
      pi("Villarreal", "villarreal", "Barcelona", "barcelona"),
    ];
    const r = resolveLiveTeamId("Villa", matches);
    assert.equal(r.matched, false);
    assert.equal(r.method, "unresolved");
    assert.ok(r.team_id.startsWith("live:"));
    assert.notEqual(r.team_id, "villarreal");
    assert.notEqual(r.team_id, "aston-villa");
  });

  it("still resolves declared aliases", () => {
    const matches = [pi("Aston Villa", "aston-villa", "Nott'm Forest", "nottingham-forest")];
    const villa = resolveLiveTeamId("Aston Villa", matches);
    const forest = resolveLiveTeamId("Nottingham Forest", matches);
    assert.equal(villa.team_id, "aston-villa");
    assert.equal(forest.team_id, "nottingham-forest");
  });
});

describe("identity matching — Understat priors", () => {
  const payload = {
    dates: [
      {
        id: "1",
        isResult: true,
        datetime: "2026-08-20 15:00:00",
        h: { id: "50", title: "Osasuna" },
        a: { id: "51", title: "Barcelona" },
        xG: { h: "1.1", a: "1.9" },
      },
      {
        id: "2",
        isResult: true,
        datetime: "2026-08-21 15:00:00",
        h: { id: "52", title: "Espanyol" },
        a: { id: "53", title: "Sevilla" },
        xG: { h: "0.8", a: "1.2" },
      },
      {
        id: "3",
        isResult: true,
        datetime: "2026-08-22 15:00:00",
        h: { id: "71", title: "Aston Villa" },
        a: { id: "73", title: "Bournemouth" },
        xG: { h: "1.4", a: "0.6" },
      },
      {
        id: "9",
        isResult: false,
        datetime: "2026-09-12 15:00:00",
        h: { id: "50", title: "Osasuna" },
        a: { id: "52", title: "Espanyol" },
        xG: { h: null, a: null },
      },
    ],
  };

  it("resolves CA Osasuna / Espanyol so home_n is not 0 when the match exists", () => {
    const matches = parseUnderstatLeagueJson(JSON.stringify(payload));
    const roll = rollingPriorXg({
      matches,
      home: "CA Osasuna",
      away: "Espanyol",
      kickoffIso: "2026-09-12T14:15:00.000Z",
    });
    assert.equal(roll.target?.id, "9");
    assert.ok(roll.prior_n_home >= 1, `expected home priors, got ${roll.prior_n_home} (${roll.home_identity.status})`);
    assert.ok(roll.prior_n_away >= 1, `expected away priors, got ${roll.prior_n_away}`);
    assert.equal(roll.home_xg_l5, 1.1);
    assert.equal(roll.away_xg_l5, 0.8);
    assert.notEqual(roll.home_identity.status, "NONE");
  });

  it("does not attach Villa short-name priors to Aston Villa rows", () => {
    const matches = parseUnderstatLeagueJson(JSON.stringify(payload));
    const roll = rollingPriorXg({
      matches,
      home: "Villa",
      away: "Espanyol",
      kickoffIso: "2026-09-12T14:15:00.000Z",
    });
    assert.equal(roll.target, null);
    assert.equal(roll.prior_n_home, 0);
    assert.equal(roll.home_identity.status, "SHORT_NAME_BLOCKED");
    assert.match(roll.home_identity.reason_it, /ambiguo|corto/i);
  });

  it("keeps Understat observations CONTEXT / not independent-model", async () => {
    const json = JSON.stringify(payload);
    const lane = await researchUnderstatLeague({
      eventId: "test-osasuna-espanyol",
      home: "CA Osasuna",
      away: "Espanyol",
      competition: "soccer_spain_la_liga",
      kickoffIso: "2026-09-12T14:15:00.000Z",
      nowIso: "2026-09-11T08:00:00.000Z",
      jsonText: json,
    });
    assert.ok(lane.status === "SUCCESS" || lane.status === "PARTIAL");
    assert.ok(lane.observations.length >= 2);
    assert.ok(lane.observations.every((o) => o.available_at === null));
    assert.ok(lane.observations.every((o) => o.enters_independent_model === false));
    assert.match(lane.reason, /home_identity=/);
    assert.match(lane.reason, /Abbinamento|chiave|Nomi squadra|Nessun/);
  });
});

describe("identity matching — Italian audit + gates", () => {
  it("explains identity failure in Italian", () => {
    const it = sourceFailureReasonIt({
      source_id: "understat",
      ok: false,
      fetched: true,
      parser_status: "NO_EVENT",
      reason: "NO_EVENT — IDENTITY_SHORT_NAME — Villa",
    });
    assert.match(it, /identit[aà]|ambigu|Villa|aggancio/i);
  });

  it("does not lower Poisson gates", () => {
    const text = readFileSync("src/domain/eval/predictive-intelligence/predict-live.ts", "utf8");
    assert.match(text, /missing_keys\.length > 45/);
    assert.match(text, /feature_coverage < 0\.35/);
  });

  it("normalize still does not invent provider ids", () => {
    assert.equal(normalizeTeamName("Man Utd"), normalizeTeamName("Manchester United FC"));
    assert.ok(identityKey("CA Osasuna"));
  });

  it("pickUniqueDatedPair keeps duplicates of the same day and fails closed across days", () => {
    const rows = [
      { date: "2026-09-12T14:00:00Z", home: "Liverpool" },
      { date: "2026-09-12T14:00:00Z", home: "Liverpool" },
      { date: "2026-09-20T14:00:00Z", home: "Liverpool" },
    ];
    const sameDay = pickUniqueDatedPair(rows, (r) => r.date, "2026-09-12T16:30:00Z");
    assert.equal(sameDay?.date?.startsWith("2026-09-12"), true);
    const wrongDay = pickUniqueDatedPair(rows, (r) => r.date, "2026-09-13T16:30:00Z");
    assert.equal(wrongDay, null);
    const ambiguous = pickUniqueDatedPair(rows, (r) => r.date, null);
    assert.equal(ambiguous, null);
  });
});
