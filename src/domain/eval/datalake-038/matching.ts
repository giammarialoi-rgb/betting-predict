import { hasUtcOffset } from "@/domain/eval/prospective-036/clocks";
import type { MatchGrade038 } from "@/domain/eval/datalake-038/types";

export function normalizeTeam038(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|afc|cf|sc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function canonicalEventKey038(input: {
  competition: string | null;
  season: string | null;
  kickoffUtc: string | null;
  home: string;
  away: string;
}): string {
  return [
    (input.competition ?? "").trim().toLowerCase(),
    (input.season ?? "").trim().toLowerCase(),
    input.kickoffUtc ?? "",
    normalizeTeam038(input.home),
    normalizeTeam038(input.away),
  ].join("|");
}

export function matchGrade038(input: {
  home: string;
  away: string;
  kickoffUtc: string | null;
  competition?: string | null;
  sourceEventId?: string | null;
}): MatchGrade038 {
  if (!input.home || !input.away) return "MATCH_FAILED";
  if (input.sourceEventId && input.kickoffUtc && hasUtcOffset(input.kickoffUtc)) {
    return "MATCH_EXACT";
  }
  if (input.kickoffUtc && hasUtcOffset(input.kickoffUtc) && input.competition) {
    return "MATCH_EXACT";
  }
  if (input.kickoffUtc && hasUtcOffset(input.kickoffUtc)) return "MATCH_PROBABLE";
  if (input.kickoffUtc) return "MATCH_AMBIGUOUS";
  return "MATCH_FAILED";
}
