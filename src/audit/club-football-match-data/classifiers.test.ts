import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  AGGREGATE_ODDS_COLUMNS,
  BET365_ODDS_COLUMNS,
  MATCHES_COLUMNS,
  classifyBookmakerColumn,
  classifyFeature,
  classifyOddsTemporal,
  eventIdentityKey,
  forbiddenPrematchFeatures,
  isProvisionalEloDate,
  parseMatchDate,
  parseMatchTime,
  pointsFromFtResult,
  teamPerspectiveResult,
  temporalMatrixRow,
  usageModeForColumn,
  validateDecimalOdds,
} from "./classifiers";

const fixtureDir = path.join(
  process.cwd(),
  "src",
  "audit",
  "club-football-match-data",
  "fixtures",
);

describe("club-football-match-data audit classifiers", () => {
  it("parses YYYY-MM-DD dates and rejects invalid", () => {
    assert.ok(parseMatchDate("2023-08-11"));
    assert.equal(parseMatchDate("11/08/2023"), null);
    assert.equal(parseMatchDate(""), null);
  });

  it("parses HH:MM:SS times without inventing timezone availability", () => {
    assert.deepEqual(parseMatchTime("20:00:00"), { hh: 20, mm: 0, ss: 0 });
    assert.equal(parseMatchTime(""), null);
    const row = temporalMatrixRow("MatchTime");
    assert.equal(row.availabilityTime.includes("must not treat"), true);
  });

  it("detects duplicate event identities", () => {
    const a = eventIdentityKey({
      division: "E0",
      matchDate: "2023-08-11",
      homeTeam: "Burnley",
      awayTeam: "Man City",
    });
    const b = eventIdentityKey({
      division: "E0",
      matchDate: "2023-08-11",
      homeTeam: "Burnley",
      awayTeam: "Man City",
    });
    const c = eventIdentityKey({
      division: "E0",
      matchDate: "2023-08-11",
      homeTeam: "Burnley",
      awayTeam: "Arsenal",
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("validates decimal odds and rejects non-odds", () => {
    assert.equal(validateDecimalOdds(1.35), true);
    assert.equal(validateDecimalOdds(1), false);
    assert.equal(validateDecimalOdds(0), false);
  });

  it("classifies Max* as AGGREGATE and Odd* as BOOKMAKER", () => {
    assert.equal(classifyBookmakerColumn("MaxHome"), "AGGREGATE");
    assert.equal(classifyBookmakerColumn("OddHome"), "BOOKMAKER");
    assert.equal(classifyBookmakerColumn("HomeTeam"), "NOT_ODDS");
    for (const col of AGGREGATE_ODDS_COLUMNS) {
      assert.equal(classifyBookmakerColumn(col), "AGGREGATE");
    }
    for (const col of BET365_ODDS_COLUMNS) {
      assert.equal(classifyBookmakerColumn(col), "BOOKMAKER");
    }
  });

  it("marks odds temporal class UNKNOWN (open/close undocumented)", () => {
    assert.equal(classifyOddsTemporal("OddHome"), "UNKNOWN");
    assert.equal(classifyOddsTemporal("MaxAway"), "UNKNOWN");
  });

  it("classifies post-match stats and clusters as leakage / post-match", () => {
    assert.equal(classifyFeature("FTResult"), "POST_MATCH");
    assert.equal(classifyFeature("HomeShots"), "POST_MATCH");
    assert.equal(classifyFeature("C_LTH"), "LEAKAGE_RISK");
    assert.equal(classifyFeature("OddHome"), "LEAKAGE_RISK");
    assert.equal(classifyFeature("Form3Home"), "DERIVED_REQUIRES_RECONSTRUCTION");
    assert.equal(classifyFeature("Division"), "RAW");
  });

  it("lists forbidden prematch features including FT and clusters", () => {
    const forbidden = forbiddenPrematchFeatures().map((f) => f.field);
    assert.ok(forbidden.includes("FTResult"));
    assert.ok(forbidden.includes("C_PHB"));
    assert.ok(forbidden.includes("OddHome"));
    assert.ok(!forbidden.includes("Division"));
  });

  it("assigns usage modes consistently", () => {
    assert.equal(usageModeForColumn("HomeTeam"), "STRICT_AS_OF");
    assert.equal(usageModeForColumn("Form5Away"), "RESEARCH_DATASET");
    assert.equal(usageModeForColumn("FTHome"), "BENCHMARK_ONLY");
  });

  it("flags provisional Elo dates after ClubElo cutoff continuation", () => {
    assert.equal(isProvisionalEloDate("2025-06-15"), true);
    assert.equal(isProvisionalEloDate("2025-06-01"), false);
  });

  it("converts team-perspective results for form reconstruction", () => {
    assert.equal(teamPerspectiveResult(true, "H"), "H");
    assert.equal(teamPerspectiveResult(false, "H"), "A");
    assert.equal(teamPerspectiveResult(false, "A"), "H");
    assert.equal(pointsFromFtResult("home", "D"), 1);
  });

  it("loads offline fixtures without network", () => {
    const matchesPath = path.join(fixtureDir, "matches_sample.csv");
    const eloPath = path.join(fixtureDir, "elo_sample.csv");
    assert.ok(fs.existsSync(matchesPath));
    assert.ok(fs.existsSync(eloPath));
    const header = fs.readFileSync(matchesPath, "utf8").split(/\r?\n/)[0].split(",");
    assert.deepEqual(header, [...MATCHES_COLUMNS]);
    const body = fs.readFileSync(matchesPath, "utf8");
    assert.ok(body.includes("Burnley"));
    assert.ok(body.includes("Man City"));
  });

  it("enforces team normalization contract: no fuzzy merge in audit helpers", () => {
    const a = eventIdentityKey({
      division: "E0",
      matchDate: "2024-01-01",
      homeTeam: "Man United",
      awayTeam: "Liverpool",
    });
    const b = eventIdentityKey({
      division: "E0",
      matchDate: "2024-01-01",
      homeTeam: "Manchester United",
      awayTeam: "Liverpool",
    });
    assert.notEqual(a, b);
  });
});
