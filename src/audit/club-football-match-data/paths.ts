import path from "node:path";

/** External clone used for forensic audit only — not a production ingest path. */
export const CLUB_FOOTBALL_MATCH_DATA_ROOT = path.join(
  process.cwd(),
  "audit",
  "external",
  "Club-Football-Match-Data",
);

export const CLUB_FOOTBALL_MATCHES_CSV = path.join(
  CLUB_FOOTBALL_MATCH_DATA_ROOT,
  "data",
  "Matches.csv",
);

export const CLUB_FOOTBALL_ELO_CSV = path.join(
  CLUB_FOOTBALL_MATCH_DATA_ROOT,
  "data",
  "EloRatings.csv",
);

export const CLUB_FOOTBALL_AUDIT_OUT_DIR = path.join(
  process.cwd(),
  "audit",
  "club-football-match-data",
);
