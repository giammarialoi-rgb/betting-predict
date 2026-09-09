import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { miniStrictPath, strictCandidatesPath } from "@/domain/eval/breakthrough-027/config";
import { capitalMatchAllowed027 } from "@/domain/eval/breakthrough-027/matching";
import { classifyLevelB } from "@/domain/eval/breakthrough-027/overlay";
import type {
  StrictCandidate027,
  WindowAvailability027,
} from "@/domain/eval/breakthrough-027/types";

const KAGGLE_URL = "https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset";
const TEMPORAL_BASIS =
  "LEVEL_B: soccer-dataset date_utc SOURCE (documented UTC, Z appended) + PHP generate_odds_series hourly LOCF bin DERIVED (hours_before). BeatTheBookie naive match_datetime is RESEARCH_ONLY (TZ undocumented).";

export function emptyWindows(eventId: string, t1h: boolean): WindowAvailability027 {
  return {
    eventId,
    "T-72h": false,
    "T-48h": false,
    "T-24h": false,
    "T-12h": false,
    "T-6h": false,
    "T-3h": false,
    "T-1h": t1h,
    "T-30m": false,
    "T-15m": false,
    "T-5m": false,
    "T-1m": false,
  };
}

export function parseStrictCandidatesCsv(text: string, retrievedAt: string): StrictCandidate027[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",");
  const idx = (name: string) => header.indexOf(name);
  const iMatch = idx("match_id");
  const iLeague = idx("league");
  const iHome = idx("home");
  const iAway = idx("away");
  const iKick = idx("soccer_kickoff_utc");
  const iBook = idx("bookmaker");
  const iHours = idx("hours_before");
  const iH = idx("home_odds");
  const iD = idx("draw_odds");
  const iA = idx("away_odds");
  const iFth = idx("ft_home");
  const iFta = idx("ft_away");
  if ([iMatch, iLeague, iHome, iAway, iKick, iBook, iHours, iH, iD, iA, iFth, iFta].some((i) => i < 0)) {
    throw new Error("strict-candidates.csv missing required columns");
  }
  const out: StrictCandidate027[] = [];
  for (let n = 1; n < lines.length; n++) {
    const cols = lines[n]!.split(",");
    const hoursBefore = Number(cols[iHours]);
    const homeOdds = Number(cols[iH]);
    const drawOdds = Number(cols[iD]);
    const awayOdds = Number(cols[iA]);
    const ftHome = Number(cols[iFth]);
    const ftAway = Number(cols[iFta]);
    if (
      !Number.isFinite(hoursBefore) ||
      !Number.isFinite(homeOdds) ||
      !Number.isFinite(drawOdds) ||
      !Number.isFinite(awayOdds) ||
      homeOdds <= 1 ||
      drawOdds <= 1 ||
      awayOdds <= 1 ||
      !Number.isInteger(ftHome) ||
      !Number.isInteger(ftAway)
    ) {
      continue;
    }
    const graded = classifyLevelB({
      soccerKickoffRaw: cols[iKick] ?? "",
      hoursBefore,
      matchGrade: "MATCH_EXACT",
      licenseCapitalOk: true,
    });
    if (!graded.capitalEligible || !graded.kickoff || !graded.quote || !capitalMatchAllowed027("MATCH_EXACT")) {
      continue;
    }
    const matchId = cols[iMatch] ?? "";
    const eventId = `btb-kaggle|${matchId}|t-${hoursBefore}h`;
    const hash = createHash("sha256")
      .update(
        `${matchId}|${graded.kickoff}|${graded.quote}|${cols[iBook]}|${homeOdds}|${drawOdds}|${awayOdds}`,
      )
      .digest("hex");
    const year = graded.kickoff.slice(0, 4);
    out.push({
      event_id: eventId,
      match_id: matchId,
      competition: cols[iLeague] ?? "",
      season: year,
      home: cols[iHome] ?? "",
      away: cols[iAway] ?? "",
      kickoff: graded.kickoff,
      odds_timestamp: graded.quote,
      hours_before: hoursBefore,
      bookmaker: cols[iBook] ?? "",
      market: "1X2",
      home_odds: homeOdds,
      draw_odds: drawOdds,
      away_odds: awayOdds,
      as_of: graded.quote,
      source: "kaggle-austro-beat-the-bookie",
      source_url: KAGGLE_URL,
      source_id: matchId,
      match_confidence: "MATCH_EXACT",
      temporal_precision: "EXACT_TIMESTAMP",
      timestamp_origin: "DERIVED_TIMESTAMP",
      capital_level: "LEVEL_B",
      retrieved_at: retrievedAt,
      published_at: null,
      available_at: graded.quote,
      observed_at: graded.quote,
      temporal_basis: TEMPORAL_BASIS,
      license_status: "GPL-3.0-upstream+kaggle-redistribution; dump-not-in-git",
      hash,
      ft_home: ftHome,
      ft_away: ftAway,
      windows: emptyWindows(eventId, hoursBefore === 1),
    });
  }
  out.sort((a, b) => {
    const t = a.kickoff.localeCompare(b.kickoff);
    return t !== 0 ? t : a.event_id.localeCompare(b.event_id);
  });
  return out;
}

export function loadStrictCandidates027(input: { skipHeavy: boolean }): {
  path: string;
  fixture: boolean;
  events: StrictCandidate027[];
} {
  const retrievedAt = "2026-09-07T00:00:00.000Z";
  if (input.skipHeavy) {
    const path = miniStrictPath();
    return {
      path,
      fixture: true,
      events: parseStrictCandidatesCsv(readFileSync(path, "utf8"), retrievedAt),
    };
  }
  const prod = strictCandidatesPath();
  if (existsSync(prod)) {
    return {
      path: prod,
      fixture: false,
      events: parseStrictCandidatesCsv(readFileSync(prod, "utf8"), retrievedAt),
    };
  }
  const path = miniStrictPath();
  return {
    path,
    fixture: true,
    events: parseStrictCandidatesCsv(readFileSync(path, "utf8"), retrievedAt),
  };
}
