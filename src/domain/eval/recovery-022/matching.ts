/**
 * Event resolver: BeatTheBookie ↔ football-data.co.uk / Club-Football / OpenLigaDB.
 * STRICT capital may use MATCH_EXACT only.
 */

import {
  normalizeCompetition,
  normalizeTeam,
} from "@/domain/eval/acquisition-019/team-normalize";
import type { NormalizedEvent } from "@/domain/eval/acquisition-019/types";
import type { MatchGrade022 } from "@/domain/eval/recovery-022/types";

export type MatchSubject022 = {
  source: string;
  match_id: string;
  date: string;
  league: string;
  home: string;
  away: string;
  kickoff: string | null;
};

export type MatchResult022 = {
  left_id: string;
  right_id: string | null;
  right_source: string | null;
  grade: MatchGrade022;
};

export function btbLeagueToCompetition(raw: string): string {
  const trimmed = raw.trim();
  const colon = trimmed.indexOf(":");
  const name = colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
  return normalizeCompetition(name);
}

export function subjectFromBtb(row: {
  match_id: string;
  league: string;
  home_team?: string;
  home?: string;
  away_team?: string;
  away?: string;
  match_date?: string;
  kickoff_date?: string;
  kickoff?: string | null;
}): MatchSubject022 {
  return {
    source: "beat_the_bookie",
    match_id: row.match_id,
    date: (row.match_date ?? row.kickoff_date ?? "").slice(0, 10),
    league: row.league,
    home: row.home_team ?? row.home ?? "",
    away: row.away_team ?? row.away ?? "",
    kickoff: row.kickoff ?? null,
  };
}

export function subjectFromNormalized(ev: NormalizedEvent): MatchSubject022 {
  return {
    source: ev.sourceId,
    match_id: ev.sourceEventId,
    date: ev.matchDate,
    league: ev.competition,
    home: ev.homeRaw,
    away: ev.awayRaw,
    kickoff: null,
  };
}

function identityKey(s: MatchSubject022): { date: string; home: string; away: string; comp: string } {
  return {
    date: s.date,
    home: normalizeTeam(s.home).slug,
    away: normalizeTeam(s.away).slug,
    comp: btbLeagueToCompetition(s.league),
  };
}

export function gradeMatch(left: MatchSubject022, rights: readonly MatchSubject022[]): MatchResult022 {
  const L = identityKey(left);
  if (!L.date || !L.home || !L.away) {
    return { left_id: left.match_id, right_id: null, right_source: null, grade: "MATCH_FAILED" };
  }
  const sameTeams = rights.filter((r) => {
    const R = identityKey(r);
    return R.date === L.date && R.home === L.home && R.away === L.away;
  });
  if (sameTeams.length === 0) {
    return { left_id: left.match_id, right_id: null, right_source: null, grade: "MATCH_FAILED" };
  }
  const exact = sameTeams.filter((r) => identityKey(r).comp === L.comp);
  if (exact.length === 1) {
    return {
      left_id: left.match_id,
      right_id: exact[0]!.match_id,
      right_source: exact[0]!.source,
      grade: "MATCH_EXACT",
    };
  }
  if (exact.length > 1) {
    return {
      left_id: left.match_id,
      right_id: null,
      right_source: exact[0]!.source,
      grade: "MATCH_AMBIGUOUS",
    };
  }
  if (sameTeams.length === 1) {
    return {
      left_id: left.match_id,
      right_id: sameTeams[0]!.match_id,
      right_source: sameTeams[0]!.source,
      grade: "MATCH_PROBABLE",
    };
  }
  return {
    left_id: left.match_id,
    right_id: null,
    right_source: sameTeams[0]!.source,
    grade: "MATCH_AMBIGUOUS",
  };
}

export function matchCorpus(
  left: readonly MatchSubject022[],
  right: readonly MatchSubject022[],
): { results: MatchResult022[]; exact: number; probable: number; ambiguous: number; failed: number } {
  const byDate = new Map<string, MatchSubject022[]>();
  for (const r of right) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }
  const results: MatchResult022[] = [];
  let exact = 0;
  let probable = 0;
  let ambiguous = 0;
  let failed = 0;
  for (const l of left) {
    const g = gradeMatch(l, byDate.get(l.date) ?? []);
    results.push(g);
    if (g.grade === "MATCH_EXACT") exact += 1;
    else if (g.grade === "MATCH_PROBABLE") probable += 1;
    else if (g.grade === "MATCH_AMBIGUOUS") ambiguous += 1;
    else failed += 1;
  }
  return { results, exact, probable, ambiguous, failed };
}

export function strictMatchingAllowed(grade: MatchGrade022): boolean {
  return grade === "MATCH_EXACT";
}
