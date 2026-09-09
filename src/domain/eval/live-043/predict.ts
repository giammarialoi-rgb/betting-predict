import type { Decision039 } from "@/domain/eval/live-039/types";
import type { Triangulation043 } from "@/domain/eval/live-043/types";
import type { CandidateClass043 } from "@/domain/eval/live-043/types";

/** MODEL_v1 = MARKET_ONLY: model probabilities mirror consensus MARKET_DEVIG. */
export function modelProbFromMarket043(
  tri: Triangulation043 | null,
  locked: Decision039 | null,
): Record<string, number> | null {
  if (locked) {
    return { HOME: locked.home_devig, DRAW: locked.draw_devig, AWAY: locked.away_devig };
  }
  if (!tri || tri.status !== "OK") return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(tri.consensus_devig)) {
    if (v != null) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function marketProbFromTri043(tri: Triangulation043 | null): Record<string, number> | null {
  return modelProbFromMarket043(tri, null);
}

export function deltaProb043(
  model: Record<string, number> | null,
  market: Record<string, number> | null,
): Record<string, number> | null {
  if (!model || !market) return null;
  const out: Record<string, number> = {};
  for (const k of Object.keys(model)) {
    if (market[k] == null) continue;
    out[k] = model[k]! - market[k]!;
  }
  return Object.keys(out).length ? out : null;
}

export function candidateGate043(input: {
  model: Record<string, number> | null;
  market: Record<string, number> | null;
  delta: Record<string, number> | null;
  dataQuality: number;
  modelConfidence: number;
  /** MODEL_v1 cannot claim edge over itself */
  marketOnly: boolean;
}): { class: CandidateClass043; edgeCandidate: boolean } {
  if (!input.model || !input.market) {
    return { class: "NO_SIGNAL", edgeCandidate: false };
  }
  if (input.marketOnly) {
    return { class: "NO_SIGNAL", edgeCandidate: false };
  }
  const maxDelta = Math.max(...Object.values(input.delta ?? { x: 0 }).map((v) => Math.abs(v)));
  if (input.dataQuality < 0.3 || input.modelConfidence < 0.3) {
    return { class: "NO_SIGNAL", edgeCandidate: false };
  }
  if (maxDelta >= 0.08 && input.dataQuality >= 0.6) {
    return { class: "STRONG_CANDIDATE", edgeCandidate: true };
  }
  if (maxDelta >= 0.04) {
    return { class: "CANDIDATE", edgeCandidate: true };
  }
  if (maxDelta >= 0.02) {
    return { class: "WATCH", edgeCandidate: false };
  }
  return { class: "NO_SIGNAL", edgeCandidate: false };
}
