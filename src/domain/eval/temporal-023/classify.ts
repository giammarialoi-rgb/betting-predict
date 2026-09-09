/**
 * Temporal phase: publishTime vs marketStartTime is the primary proof.
 * inPlay=false is never sufficient for PREMATCH.
 */

import type { Phase023, TemporalPrecision023 } from "@/domain/eval/temporal-023/types";

export function secondsToKickoff(
  marketStartTimeIso: string | null,
  publishTimeMs: number,
): number | null {
  if (marketStartTimeIso == null) return null;
  const start = Date.parse(marketStartTimeIso);
  if (!Number.isFinite(start)) return null;
  return (start - publishTimeMs) / 1000;
}

export function classifyPhase(input: {
  publishTimeMs: number;
  marketStartTimeIso: string | null;
  status: string | null;
}): Phase023 {
  if (!Number.isFinite(input.publishTimeMs) || input.publishTimeMs <= 0) {
    return "UNKNOWN";
  }
  if (input.marketStartTimeIso == null) return "UNKNOWN";
  const start = Date.parse(input.marketStartTimeIso);
  if (!Number.isFinite(start)) return "UNKNOWN";
  if (input.publishTimeMs < start) return "PREMATCH";
  if (input.status === "CLOSED") return "POSTMATCH";
  return "INPLAY";
}

export function temporalPrecisionForPt(publishTimeMs: number): TemporalPrecision023 {
  if (!Number.isFinite(publishTimeMs) || publishTimeMs <= 0) return "unknown";
  return "exact";
}

export function canonicalSelection(input: {
  selectionName: string;
  sortPriority: number | null;
}): "HOME" | "DRAW" | "AWAY" | "OTHER" {
  const n = input.selectionName.trim().toLowerCase();
  if (n === "the draw" || n === "draw") return "DRAW";
  if (input.sortPriority === 1) return "HOME";
  if (input.sortPriority === 2) return "AWAY";
  if (input.sortPriority === 3) return "DRAW";
  return "OTHER";
}
