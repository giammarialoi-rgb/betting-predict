import { normalizeTeam } from "@/domain/eval/acquisition-019/team-normalize";
import type { MatchGrade027 } from "@/domain/eval/breakthrough-027/types";

export function identityKey(date: string, home: string, away: string): string {
  const h = normalizeTeam(home).slug;
  const a = normalizeTeam(away).slug;
  return `${date}|${h}|${a}`;
}

/**
 * Unique calendar-date + home slug + away slug → MATCH_EXACT.
 * Never nearest-neighbour. Never assume kickoff = first odds timestamp.
 */
export function gradeUniqueCount(candidateCount: number): MatchGrade027 {
  if (candidateCount === 1) return "MATCH_EXACT";
  if (candidateCount > 1) return "MATCH_AMBIGUOUS";
  return "MATCH_FAILED";
}

export function capitalMatchAllowed027(grade: MatchGrade027): boolean {
  return grade === "MATCH_EXACT";
}
