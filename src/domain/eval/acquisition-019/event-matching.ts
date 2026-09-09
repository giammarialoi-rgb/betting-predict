/**
 * external_event → normalized_event → canonical event_id → candidate observations.
 * Matching confidence is independent of source reliability (always unmeasured).
 */

import {
  combineMatchConfidence,
  normalizeCompetition,
  normalizeTeam,
} from "@/domain/eval/acquisition-019/team-normalize";
import type {
  EventMatch,
  MatchingConfidence,
  NormalizedEvent,
} from "@/domain/eval/acquisition-019/types";

export function canonicalEventId(input: {
  competition: string;
  matchDate: string;
  homeSlug: string;
  awaySlug: string;
}): string {
  return `fb|${input.competition}|${input.matchDate}|${input.homeSlug}|${input.awaySlug}`;
}

export function buildNormalizedEvent(input: {
  sourceId: string;
  sourceEventId: string;
  competitionRaw: string;
  matchDate: string;
  year: number;
  season: string;
  homeRaw: string;
  awayRaw: string;
  ftHome: number | null;
  ftAway: number | null;
}): NormalizedEvent {
  const home = normalizeTeam(input.homeRaw);
  const away = normalizeTeam(input.awayRaw);
  const competition = normalizeCompetition(input.competitionRaw);
  const confidence = combineMatchConfidence(home.confidence, away.confidence);
  const id = canonicalEventId({
    competition,
    matchDate: input.matchDate,
    homeSlug: home.slug,
    awaySlug: away.slug,
  });
  let result: NormalizedEvent["result"] = null;
  if (input.ftHome != null && input.ftAway != null) {
    result =
      input.ftHome > input.ftAway
        ? "HOME"
        : input.ftHome < input.ftAway
          ? "AWAY"
          : "DRAW";
  }
  return {
    canonicalEventId: id,
    sourceEventId: input.sourceEventId,
    sourceId: input.sourceId,
    competition,
    season: input.season,
    matchDate: input.matchDate,
    year: input.year,
    homeRaw: input.homeRaw,
    awayRaw: input.awayRaw,
    homeSlug: home.slug,
    awaySlug: away.slug,
    ftHome: input.ftHome,
    ftAway: input.ftAway,
    result,
    matchingConfidence: home.slug && away.slug ? confidence : "unmatched",
  };
}

export function matchKey(event: Pick<NormalizedEvent, "matchDate" | "homeSlug" | "awaySlug">): string {
  return `${event.matchDate}|${event.homeSlug}|${event.awaySlug}`;
}

export function matchEvents(
  left: readonly NormalizedEvent[],
  right: readonly NormalizedEvent[],
): { matches: EventMatch[]; unmatchedLeft: number; unmatchedRight: number } {
  const rightByKey = new Map<string, NormalizedEvent[]>();
  for (const r of right) {
    const k = matchKey(r);
    const arr = rightByKey.get(k) ?? [];
    arr.push(r);
    rightByKey.set(k, arr);
  }
  const usedRight = new Set<string>();
  const matches: EventMatch[] = [];
  let unmatchedLeft = 0;
  for (const l of left) {
    const candidates = rightByKey.get(matchKey(l)) ?? [];
    const hit = candidates.find((c) => !usedRight.has(c.sourceEventId));
    if (!hit || l.matchingConfidence === "unmatched") {
      unmatchedLeft += 1;
      continue;
    }
    usedRight.add(hit.sourceEventId);
    const confidence: MatchingConfidence =
      l.matchingConfidence === "exact_alias" &&
      hit.matchingConfidence === "exact_alias"
        ? "exact_alias"
        : "deterministic_slug";
    matches.push({
      leftEventId: l.sourceEventId,
      rightEventId: hit.sourceEventId,
      canonicalEventId: l.canonicalEventId,
      confidence,
    });
  }
  return {
    matches,
    unmatchedLeft,
    unmatchedRight: right.length - usedRight.size,
  };
}

export function seasonFromIsoDate(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "unknown";
  if (m >= 7) {
    return `${String(y).slice(2)}${String(y + 1).slice(2)}`;
  }
  return `${String(y - 1).slice(2)}${String(y).slice(2)}`;
}

export function seasonLabelFromCode(code: string): string {
  if (!/^\d{4}$/.test(code)) return code;
  const a = Number(code.slice(0, 2));
  const b = Number(code.slice(2, 4));
  const start = a >= 93 ? 1900 + a : 2000 + a;
  const end = b >= 93 ? 1900 + b : 2000 + b;
  return `${start}/${String(end).slice(2)}`;
}
