import { buildBreakthrough027Assessment } from "@/domain/eval/breakthrough-027/evidence";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import type { WalkRow029 } from "@/domain/eval/incremental-029/walk";

export function sampleEvidence029(row: WalkRow029 | null): ReturnType<typeof buildBreakthrough027Assessment> | null {
  if (!row) return null;
  return buildBreakthrough027Assessment({
    event: row.event,
    modelProbs: row.market,
    hypothesis: "MARKET_ONLY",
  });
}

export function blockedNewsNote(event: StrictCandidate027): string {
  return `${event.event_id}: news/lineup/weather not MATCH_EXACT at asOf=${event.as_of}`;
}
