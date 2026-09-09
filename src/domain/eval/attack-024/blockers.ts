import { STRICT_EVENT_GATE } from "@/domain/eval/attack-024/types";
import type { NextBlocker024, RejectBucket024 } from "@/domain/eval/attack-024/types";

export function rejectBuckets(input: {
  soccerOddsFixtures: number;
  soccerMidnightFixtures: number;
  soccerClockFixtures: number;
  soccerOddsRows: number;
  btbClosingEvents: number;
  btbSeriesAcquired: boolean;
  betfairOfficialEvents: number;
  strictEvents: number;
}): RejectBucket024[] {
  return [
    {
      reason: "soccer-dataset known_at = date_utc (closing/around kickoff) — not quote < kickoff",
      events: input.soccerClockFixtures,
      odds_rows: input.soccerOddsRows,
    },
    {
      reason: "soccer-dataset kickoff midnight placeholder (00:00:00) plus known_at copied",
      events: input.soccerMidnightFixtures,
      odds_rows: 0,
    },
    {
      reason: "BeatTheBookie closing_odds.csv DATE_ONLY match_date",
      events: input.btbClosingEvents,
      odds_rows: input.btbClosingEvents,
    },
    {
      reason: input.btbSeriesAcquired
        ? "BeatTheBookie odds_series relative hourly bins, timezone unverified"
        : "BeatTheBookie odds_series / odds_series_b / SQL dump NOT_ACQUIRED",
      events: 0,
      odds_rows: 0,
    },
    {
      reason: "Betfair Historic official bulk login-gated (BASIC £0 not used)",
      events: input.betfairOfficialEvents,
      odds_rows: 0,
    },
  ].filter((b) => b.events > 0 || b.reason.includes("NOT_ACQUIRED") || b.reason.includes("login-gated"));
}

export function nextDataBlockers(strictEvents: number): NextBlocker024[] {
  const rows: NextBlocker024[] = [
    {
      rank: 1,
      id: "betfair-historic-basic-login",
      action:
        "Log into historicdata.betfair.com with a dedicated research account (not this run). Free BASIC Soccer, MATCH_ODDS, Premier League, start 2019–20, 100 then 500 events. Do not buy Advanced until BASIC is STRICT.",
      expected_information_gain: "high",
      acquisition_cost: "£0 + login (credentials not used here)",
      notes: `STRICT now ${strictEvents} < ${STRICT_EVENT_GATE}. BASIC pt vs marketTime is the proven clock (TASK 023).`,
    },
    {
      rank: 2,
      id: "beatthebookie-sql-odds-datetime",
      action:
        "If Dropbox/Drive ever serves the SQL dump without login tricks, parse odds_history_series.odds_datetime. Still refuse STRICT until timezone is documented.",
      expected_information_gain: "medium",
      acquisition_cost: "free if the zip is public; currently HTML interstitial / NOT_ACQUIRED",
      notes: "TXT hourly series destroy absolute odds_datetime even if acquired.",
    },
    {
      rank: 3,
      id: "beatthebookie-odds-series-txt",
      action: "Do not prioritize odds_series TXT for STRICT. Relative 60 min LOCF, TZ unknown.",
      expected_information_gain: "low",
      acquisition_cost: "Dropbox/Drive blocked; would not unlock UTC STRICT anyway",
      notes: "Figure2B 5→1h is CASE B relative on the dataset clock only.",
    },
  ];
  return rows;
}
