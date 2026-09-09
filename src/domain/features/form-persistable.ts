import type { HistoricalMatch } from "@/domain/features/types";
import { computeFormPoints, type FormWindow } from "@/domain/features/form";
import type { FeatureCell } from "@/domain/features/types";
import { getFeatureLineage } from "@/domain/features/lineage";

/**
 * Persistable form reconstruction.
 * Critical: uses result available_at, NOT match kickoff alone.
 */
export function reconstructFormFromOutcomes(input: {
  teamId: string;
  decisionEventId: string;
  asOf: Date;
  window: FormWindow;
  /**
   * Prior outcomes as historical matches.
   * resultAvailableAt MUST be the source publication/availability time.
   */
  history: readonly HistoricalMatch[];
}): FeatureCell<number> {
  const lineage = getFeatureLineage(`form_${input.window}_overall`);
  const cell = computeFormPoints({
    history: input.history,
    teamId: input.teamId,
    asOf: input.asOf,
    window: input.window,
    excludeMatchId: input.decisionEventId,
    side: "overall",
  });

  if (
    cell.status === "RECONSTRUCTED_STRICT" &&
    lineage?.minimumHistory &&
    typeof cell.notes === "string"
  ) {
    const match = /n=(\d+)\//.exec(cell.notes);
    const n = match ? Number(match[1]) : 0;
    if (n < lineage.minimumHistory) {
      return {
        ...cell,
        value: null,
        status: "MISSING",
        notes: `INSUFFICIENT_HISTORY n=${n} min=${lineage.minimumHistory}`,
      };
    }
  }

  return cell;
}

/**
 * Demonstrates the anti-pattern: filtering only by kickoff date is insufficient.
 * Returns matches that would incorrectly leak if available_at were ignored.
 */
export function matchesWithLateAvailability(input: {
  history: readonly HistoricalMatch[];
  asOf: Date;
  decisionKickoff: Date;
}): HistoricalMatch[] {
  return input.history.filter(
    (m) =>
      m.kickoffAt.getTime() < input.decisionKickoff.getTime() &&
      m.resultAvailableAt.getTime() > input.asOf.getTime(),
  );
}
