import { gradeTwoEvents as grade025, strictMatchAllowed } from "@/domain/eval/turnaround-025/matching";
import type { FixtureIdentity026, MatchGrade026 } from "@/domain/eval/bottleneck-026/types";

export function toMatchGrade026(grade: ReturnType<typeof grade025>): MatchGrade026 {
  if (grade === "MATCH_EXACT") return "EXACT";
  if (grade === "MATCH_AMBIGUOUS") return "AMBIGUOUS";
  if (grade === "MATCH_FAILED") return "FAILED";
  return "PROBABLE";
}

export function matchFixtures(a: FixtureIdentity026, b: FixtureIdentity026): MatchGrade026 {
  const g = grade025({
    dateA: a.date,
    dateB: b.date,
    homeA: a.home,
    homeB: b.home,
    awayA: a.away,
    awayB: b.away,
    competitionA: a.competition,
    competitionB: b.competition,
  });
  return toMatchGrade026(g);
}

export function capitalMatchAllowed(grade: MatchGrade026): boolean {
  return grade === "EXACT";
}

export function capitalMatchFrom025(grade: Parameters<typeof strictMatchAllowed>[0]): boolean {
  return strictMatchAllowed(grade);
}
