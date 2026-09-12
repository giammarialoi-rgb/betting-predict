import type { LabDecision048 } from "@/domain/eval/factory-048/config";
import type { SliceDecision } from "@/domain/eval/real-pipeline/types";

/** Map Decision-048 (canonical engine) onto the mandated slice labels. */
export function sliceDecisionFrom048(
  raw: LabDecision048 | string | null | undefined,
): SliceDecision {
  const u = String(raw ?? "").toUpperCase();
  if (u === "INSUFFICIENT_DATA" || u.includes("INSUFFICIENT")) return "INSUFFICIENT DATA";
  if (u === "STRONG_CANDIDATE" || u === "BET_CANDIDATE" || u === "BET") return "BET";
  if (u === "MODEL_UNCERTAIN" || u === "WATCH" || u === "TOP_WATCHLIST") return "WATCH";
  return "NO BET";
}
