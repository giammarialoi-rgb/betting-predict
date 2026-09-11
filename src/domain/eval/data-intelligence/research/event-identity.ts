/**
 * Canonical event / team identity. `live:` slugs are provisional, never definitive.
 * Provider IDs stay null unless actually observed.
 */
import {
  mapCompetitionToPiDivision,
  resolveLivePiTarget,
  resolveLiveTeamId,
} from "@/domain/eval/predictive-intelligence/live-resolve";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";

export type ResolvedTeamIdentity = {
  display_name: string;
  canonical_id: string;
  matched: boolean;
  method: string;
  provisional: boolean;
  source_ids: {
    sofascore: string | null;
    api_sports: string | null;
    fbref: string | null;
    understat: string | null;
    football_data: string | null;
  };
};

export type CanonicalEventIdentity = {
  canonical_home_team: string;
  canonical_away_team: string;
  competition: string | null;
  division: string | null;
  kickoff: string | null;
  home: ResolvedTeamIdentity;
  away: ResolvedTeamIdentity;
  match_confidence: "HIGH" | "MEDIUM" | "PROVISIONAL";
};

function teamFrom(display: string, resolved: ReturnType<typeof resolveLiveTeamId>): ResolvedTeamIdentity {
  const provisional = !resolved.matched || resolved.team_id.startsWith("live:");
  return {
    display_name: display,
    canonical_id: resolved.team_id,
    matched: resolved.matched,
    method: resolved.method,
    provisional,
    source_ids: {
      sofascore: null,
      api_sports: null,
      fbref: null,
      understat: null,
      football_data: resolved.matched && !provisional ? resolved.team_id : null,
    },
  };
}

export function resolveCanonicalEventIdentity(input: {
  home: string;
  away: string;
  competition?: string | null;
  kickoff?: string | null;
  labBRoot?: string;
}): CanonicalEventIdentity {
  const matches = loadPiMatches(input.labBRoot);
  const target = resolveLivePiTarget({
    home_team: input.home,
    away_team: input.away,
    competition: input.competition,
    matches,
  });
  const home = teamFrom(input.home, resolveLiveTeamId(input.home, matches));
  const away = teamFrom(input.away, resolveLiveTeamId(input.away, matches));
  const both = home.matched && away.matched && !home.provisional && !away.provisional;
  const match_confidence: CanonicalEventIdentity["match_confidence"] = both
    ? target.division
      ? "HIGH"
      : "MEDIUM"
    : "PROVISIONAL";
  return {
    canonical_home_team: home.canonical_id,
    canonical_away_team: away.canonical_id,
    competition: input.competition ?? null,
    division: target.division ?? mapCompetitionToPiDivision(input.competition),
    kickoff: input.kickoff ?? null,
    home,
    away,
    match_confidence,
  };
}

export function isProvisionalCanonicalId(id: string): boolean {
  return id.startsWith("live:");
}

function stripClubSuffix(name: string): string {
  return name
    .replace(/\b(fc|afc|cf|sc|club)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveTeamIdentity(
  name: string,
  matches?: ReturnType<typeof loadPiMatches>,
): ResolvedTeamIdentity {
  const cleaned = stripClubSuffix(name) || name;
  return teamFrom(name, resolveLiveTeamId(cleaned, matches ?? loadPiMatches()));
}

export function resolveCompetitionIdentity(name: string | null | undefined): {
  source_name: string;
  canonical_name: string | null;
  canonical_id: string | null;
  confidence: "HIGH" | "MEDIUM" | "PROVISIONAL";
  resolution_method: string;
} {
  const source_name = String(name ?? "").trim();
  const div = mapCompetitionToPiDivision(source_name);
  if (div) {
    return {
      source_name,
      canonical_name: div,
      canonical_id: div,
      confidence: "HIGH",
      resolution_method: "division_map",
    };
  }
  const slug = source_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    source_name,
    canonical_name: null,
    canonical_id: slug ? `live:${slug}` : null,
    confidence: "PROVISIONAL",
    resolution_method: "unresolved_slug",
  };
}

export function resolveEventIdentity(input: {
  home: string;
  away: string;
  competition?: string | null;
  kickoff?: string | null;
  labBRoot?: string;
}): CanonicalEventIdentity {
  return resolveCanonicalEventIdentity(input);
}

/** UTC calendar day of kickoff. DATE_ONLY when time missing. */
export function matchDayUtc(kickoffIso: string | null | undefined): string | null {
  if (!kickoffIso) return null;
  const t = Date.parse(kickoffIso);
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  const d = kickoffIso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * Cross-source identity: date + canonical home/away.
 * Competition labels differ across providers; PI division is optional tightening.
 */
export function eventIdentityKey(input: {
  home: string;
  away: string;
  kickoff?: string | null;
  labBRoot?: string;
}): string {
  const home = resolveTeamIdentity(input.home, undefined).canonical_id;
  const away = resolveTeamIdentity(input.away, undefined).canonical_id;
  const day = matchDayUtc(input.kickoff) ?? "unknown";
  return `${day}|${home}|${away}`;
}

export function eventsShareIdentity(
  a: { home_or_a?: string; away_or_b?: string; kickoff_utc?: string | null; home?: string; away?: string },
  b: { home_or_a?: string; away_or_b?: string; kickoff_utc?: string | null; home?: string; away?: string },
): boolean {
  const ka = eventIdentityKey({
    home: a.home_or_a ?? a.home ?? "",
    away: a.away_or_b ?? a.away ?? "",
    kickoff: a.kickoff_utc ?? null,
  });
  const kb = eventIdentityKey({
    home: b.home_or_a ?? b.home ?? "",
    away: b.away_or_b ?? b.away ?? "",
    kickoff: b.kickoff_utc ?? null,
  });
  if (ka.endsWith("|") || kb.endsWith("|")) return false;
  if (ka.includes("unknown") || kb.includes("unknown")) return false;
  return ka === kb;
}
