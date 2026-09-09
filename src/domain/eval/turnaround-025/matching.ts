import { buildNormalizedEvent, matchKey } from "@/domain/eval/acquisition-019/event-matching";
import { normalizeCompetition, normalizeTeam } from "@/domain/eval/acquisition-019/team-normalize";
import type { MatchGrade025 } from "@/domain/eval/turnaround-025/types";

/** Local alignment only — do not invent kickoff clocks. EPL ≡ football-data E0. */
const COMPETITION_ALIGN: Readonly<Record<string, string>> = Object.freeze({
  epl: "e0",
  "english-premier-league": "e0",
  "premier-league": "e0",
});

export function alignedCompetition(raw: string): string {
  const n = normalizeCompetition(raw);
  return COMPETITION_ALIGN[n] ?? n;
}

export function teamsExact(a: string, b: string): boolean {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  return na.slug !== "" && na.slug === nb.slug;
}

export function matchGrade(input: {
  sameDate: boolean;
  homeExact: boolean;
  awayExact: boolean;
  competitionAligned: boolean;
  kickoffExactBoth: boolean;
  ambiguous: boolean;
}): MatchGrade025 {
  if (input.ambiguous) return "MATCH_AMBIGUOUS";
  if (input.sameDate && input.homeExact && input.awayExact && input.competitionAligned) {
    return "MATCH_EXACT";
  }
  if (input.sameDate && input.homeExact && input.awayExact) return "MATCH_HIGH_CONFIDENCE";
  if (input.sameDate && (input.homeExact || input.awayExact)) return "MATCH_PROBABLE";
  return "MATCH_FAILED";
}

export function gradeTwoEvents(input: {
  dateA: string;
  dateB: string;
  homeA: string;
  homeB: string;
  awayA: string;
  awayB: string;
  competitionA: string;
  competitionB: string;
  ambiguous?: boolean;
}): MatchGrade025 {
  return matchGrade({
    sameDate: input.dateA === input.dateB,
    homeExact: teamsExact(input.homeA, input.homeB),
    awayExact: teamsExact(input.awayA, input.awayB),
    competitionAligned: alignedCompetition(input.competitionA) === alignedCompetition(input.competitionB),
    kickoffExactBoth: false,
    ambiguous: input.ambiguous === true,
  });
}

export function strictMatchAllowed(grade: MatchGrade025): boolean {
  return grade === "MATCH_EXACT";
}

export function betfairToClubKey(input: {
  kickoffIso: string;
  home: string;
  away: string;
  competitionRaw: string;
}): string {
  const date = input.kickoffIso.slice(0, 10);
  const n = buildNormalizedEvent({
    sourceId: "betfair",
    sourceEventId: "x",
    competitionRaw: input.competitionRaw,
    matchDate: date,
    year: Number(date.slice(0, 4)),
    season: date.slice(0, 4),
    homeRaw: input.home,
    awayRaw: input.away,
    ftHome: null,
    ftAway: null,
  });
  return matchKey(n);
}
