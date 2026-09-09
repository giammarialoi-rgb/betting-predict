import { assertAsOf } from "@/lib/as-of";
import type { FeatureCell, HistoricalMatch } from "@/domain/features/types";

export type FormSide = "overall" | "home" | "away";

export type FormWindow = 3 | 5 | 10;

function teamPoints(match: HistoricalMatch, teamId: string): number | null {
  const home = match.homeTeamId === teamId;
  const away = match.awayTeamId === teamId;
  if (!home && !away) return null;
  if (match.ftResult === "D") return 1;
  if (match.ftResult === "H") return home ? 3 : 0;
  if (match.ftResult === "A") return away ? 3 : 0;
  return null;
}

/**
 * Matches usable for form at decision time for teamId, excluding eventId.
 * Requires resultAvailableAt <= asOf (NO LOOK-AHEAD).
 */
export function priorMatchesForTeam(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  excludeMatchId?: string;
  side?: FormSide;
  competitionId?: string;
}): HistoricalMatch[] {
  const side = input.side ?? "overall";
  const out: HistoricalMatch[] = [];
  for (const m of input.history) {
    if (input.excludeMatchId && m.matchId === input.excludeMatchId) continue;
    if (m.resultAvailableAt.getTime() > input.asOf.getTime()) continue;
    assertAsOf(input.asOf, m.resultAvailableAt);
    if (input.competitionId && m.competitionId !== input.competitionId) continue;
    const isHome = m.homeTeamId === input.teamId;
    const isAway = m.awayTeamId === input.teamId;
    if (!isHome && !isAway) continue;
    if (side === "home" && !isHome) continue;
    if (side === "away" && !isAway) continue;
    out.push(m);
  }
  return out.sort(
    (a, b) => a.resultAvailableAt.getTime() - b.resultAvailableAt.getTime(),
  );
}

export function computeFormPoints(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  window: FormWindow;
  side?: FormSide;
  excludeMatchId?: string;
  competitionId?: string;
}): FeatureCell<number> {
  const prior = priorMatchesForTeam(input);
  const slice = prior.slice(-input.window);
  if (slice.length === 0) {
    return {
      featureId: `form_${input.window}_${input.side ?? "overall"}`,
      value: null,
      source: "reconstructed_results",
      availableAt: null,
      temporalPrecision: "exact",
      status: "MISSING",
      notes: "insufficient_prior_matches",
    };
  }
  let points = 0;
  for (const m of slice) {
    const p = teamPoints(m, input.teamId);
    if (p === null) continue;
    points += p;
  }
  const latest = slice[slice.length - 1]!;
  return {
    featureId: `form_${input.window}_${input.side ?? "overall"}`,
    value: points,
    source: "reconstructed_results",
    availableAt: latest.resultAvailableAt,
    temporalPrecision: "exact",
    status: "RECONSTRUCTED_STRICT",
    notes: `n=${slice.length}/${input.window}`,
  };
}

export function computeFormBundle(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  excludeMatchId?: string;
}): Record<string, FeatureCell<number>> {
  const sides: FormSide[] = ["overall", "home", "away"];
  const windows: FormWindow[] = [3, 5, 10];
  const out: Record<string, FeatureCell<number>> = {};
  for (const side of sides) {
    for (const window of windows) {
      if (side !== "overall" && window === 10) continue;
      if (side !== "overall" && window === 3) continue;
      const cell = computeFormPoints({ ...input, window, side });
      out[cell.featureId] = cell;
    }
  }
  return out;
}
