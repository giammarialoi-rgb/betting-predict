/**
 * Persist resolved team identity — no silent ID conversion.
 */
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { resolveLiveTeamId, resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";

export type TeamIdentity = {
  display_name: string;
  canonical_id: string;
  matched: boolean;
  method: string;
  aliases: string[];
  competition: string | null;
};

export type EventTeamIdentity = {
  home: TeamIdentity;
  away: TeamIdentity;
  division: string | null;
  season: string;
};

export function resolveEventTeamIdentity(input: {
  home: string;
  away: string;
  competition?: string | null;
  labBRoot?: string;
}): EventTeamIdentity {
  const matches = loadPiMatches(input.labBRoot);
  const target = resolveLivePiTarget({
    home_team: input.home,
    away_team: input.away,
    competition: input.competition,
    matches,
  });
  const home = resolveLiveTeamId(input.home, matches);
  const away = resolveLiveTeamId(input.away, matches);
  return {
    home: {
      display_name: input.home,
      canonical_id: target.home_team_id,
      matched: home.matched,
      method: home.method,
      aliases: uniqueAliases(input.home, target.home_team_id),
      competition: target.division,
    },
    away: {
      display_name: input.away,
      canonical_id: target.away_team_id,
      matched: away.matched,
      method: away.method,
      aliases: uniqueAliases(input.away, target.away_team_id),
      competition: target.division,
    },
    division: target.division,
    season: target.season,
  };
}

function uniqueAliases(display: string, canonical: string): string[] {
  const raw = [
    display,
    display.toLowerCase(),
    canonical,
    canonical.startsWith("live:") ? canonical : `live:${canonical}`,
  ];
  return [...new Set(raw.filter(Boolean))];
}

export function sameCanonicalTeam(a: string, b: string, labBRoot?: string): boolean {
  const matches = loadPiMatches(labBRoot);
  const ra = resolveLiveTeamId(a, matches);
  const rb = resolveLiveTeamId(b, matches);
  return ra.matched && rb.matched && ra.team_id === rb.team_id;
}