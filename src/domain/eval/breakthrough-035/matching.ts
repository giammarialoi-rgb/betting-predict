import { classifyQuote035 } from "@/domain/eval/breakthrough-035/gate";
import type { GatedQuote035, MatchGrade035, MatchReport035, NormalizedQuote035 } from "@/domain/eval/breakthrough-035/types";

export function matchGrade035(q: NormalizedQuote035): MatchGrade035 {
  if (q.ft_home != null && q.ft_away != null && q.home && q.away && q.kickoff_timestamp && q.quote_has_offset && q.kickoff_has_offset) {
    return "MATCH_EXACT";
  }
  if (q.ft_home != null && q.ft_away != null && q.home && q.away) return "MATCH_PROBABLE";
  if (q.home && q.away && q.kickoff_timestamp) return "UNMATCHED";
  if (q.home && !q.away) return "MATCH_AMBIGUOUS";
  return "MATCH_FAILED";
}

export function gateQuotes035(quotes: readonly NormalizedQuote035[]): GatedQuote035[] {
  return quotes.map((q) => ({
    ...q,
    temporal_class: classifyQuote035(q),
    match_grade: matchGrade035(q),
  }));
}

export function matchReport035(gated: readonly GatedQuote035[]): MatchReport035 {
  const events = new Map<string, GatedQuote035>();
  for (const q of gated) {
    if (!events.has(q.event_id)) events.set(q.event_id, q);
  }
  const counts = { exact: 0, probable: 0, ambiguous: 0, failed: 0, unmatched: 0 };
  const collisions: string[] = [];
  const seen = new Map<string, string>();
  for (const q of events.values()) {
    if (q.match_grade === "MATCH_EXACT") counts.exact += 1;
    else if (q.match_grade === "MATCH_PROBABLE") counts.probable += 1;
    else if (q.match_grade === "MATCH_AMBIGUOUS") counts.ambiguous += 1;
    else if (q.match_grade === "UNMATCHED") counts.unmatched += 1;
    else counts.failed += 1;
    if (q.home && q.away && q.kickoff_timestamp) {
      const key = `${q.home.toLowerCase()}|${q.away.toLowerCase()}|${q.kickoff_timestamp}`;
      const prev = seen.get(key);
      if (prev && prev !== q.event_id) collisions.push(`${key} :: ${prev} vs ${q.event_id}`);
      else seen.set(key, q.event_id);
    }
  }
  return { ...counts, collisions: collisions.slice(0, 50) };
}
