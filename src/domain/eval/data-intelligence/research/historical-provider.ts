/**
 * Historical priors: Football-Data first, Club-Football-Match-Data only if the file
 * actually contains these teams. Directory presence is not SUCCESS.
 */
import { existsSync } from "node:fs";
import { inspectFootballDataArchive, type ArchiveLookup } from "@/domain/eval/data-intelligence/research/archive-lookup";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";

export type HistoricalLookup = {
  provider: "football-data-co-uk" | "club-football-match-data" | "none";
  status: ArchiveLookup["status"] | "MISSING_FILE";
  football_data: ArchiveLookup;
  club_football_file_present: boolean;
  reason: string;
};

export function lookupHistoricalPriors(input: {
  home: string;
  away: string;
  competition?: string | null;
  kickoffIso: string;
  labBRoot?: string;
}): HistoricalLookup {
  const football_data = inspectFootballDataArchive(input);
  const club_football_file_present = existsSync(CLUB_FOOTBALL_MATCHES_CSV);

  if (football_data.status === "SUCCESS" || football_data.status === "PARTIAL") {
    return {
      provider: "football-data-co-uk",
      status: football_data.status,
      football_data,
      club_football_file_present,
      reason: football_data.reason,
    };
  }

  if (!club_football_file_present) {
    return {
      provider: football_data.file_present ? "football-data-co-uk" : "none",
      status: football_data.status,
      football_data,
      club_football_file_present: false,
      reason: `${football_data.reason} Club-Football-Match-Data Matches.csv assente — non usato come SUCCESS.`,
    };
  }

  return {
    provider: "club-football-match-data",
    status: "NO_EVENT",
    football_data,
    club_football_file_present: true,
    reason:
      "Club-Football-Match-Data file present but this event is not bound to parsed rows (no invented team match).",
  };
}
