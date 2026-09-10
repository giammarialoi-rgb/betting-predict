/**
 * Event-specific ClubElo lookup. CSV presence is not team success.
 */
import { loadClubEloCacheSync, resolveTeamEloAsOf } from "@/domain/eval/data-intelligence/clubelo-cache";

export type ClubEloEventLookup = {
  file_present: boolean;
  home_rating: number | null;
  away_rating: number | null;
  home_available_at: string | null;
  away_available_at: string | null;
  status: "SUCCESS" | "PARTIAL" | "NO_DATA" | "MISSING_FILE";
  fields_extracted: string[];
  reason: string;
};

export function inspectClubEloForEvent(input: {
  home: string;
  away: string;
  kickoffIso: string;
  cwd?: string;
}): ClubEloEventLookup {
  const observations = loadClubEloCacheSync(input.cwd);
  if (!observations.length) {
    return {
      file_present: false,
      home_rating: null,
      away_rating: null,
      home_available_at: null,
      away_available_at: null,
      status: "MISSING_FILE",
      fields_extracted: [],
      reason: "Nessun CSV ClubElo locale. Nessun Elo inventato.",
    };
  }
  const home = resolveTeamEloAsOf({
    observations,
    teamName: input.home,
    matchDateIso: input.kickoffIso,
  });
  const away = resolveTeamEloAsOf({
    observations,
    teamName: input.away,
    matchDateIso: input.kickoffIso,
  });
  if (!home && !away) {
    return {
      file_present: true,
      home_rating: null,
      away_rating: null,
      home_available_at: null,
      away_available_at: null,
      status: "NO_DATA",
      fields_extracted: [],
      reason: "CSV ClubElo presente, ma nessuna rating as-of per queste due squadre (o rating_date >= kickoff).",
    };
  }
  if (!home || !away) {
    const fields = [
      ...(home ? ["home_elo"] : []),
      ...(away ? ["away_elo"] : []),
    ];
    return {
      file_present: true,
      home_rating: home?.rating ?? null,
      away_rating: away?.rating ?? null,
      home_available_at: home?.available_at ?? null,
      away_available_at: away?.available_at ?? null,
      status: "PARTIAL",
      fields_extracted: fields,
      reason: `ClubElo parziale: casa=${home ? "ok" : "mancante"}, trasferta=${away ? "ok" : "mancante"}.`,
    };
  }
  return {
    file_present: true,
    home_rating: home.rating,
    away_rating: away.rating,
    home_available_at: home.available_at,
    away_available_at: away.available_at,
    status: "SUCCESS",
    fields_extracted: ["home_elo", "away_elo", "elo_diff"],
    reason: `ClubElo as-of: home=${home.rating.toFixed(1)} away=${away.rating.toFixed(1)}.`,
  };
}
