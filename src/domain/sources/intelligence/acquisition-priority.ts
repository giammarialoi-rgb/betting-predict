/**
 * Acquisition priority ≈ Expected Information Gain / Implementation Cost.
 * Components may be UNKNOWN — ratio then UNKNOWN.
 */

import type { AcquisitionPriority, ScoreComponent, SourceIntelligence } from "./types";
import { computeSourceValueScore } from "./value-score";

function estimateEig(s: SourceIntelligence): ScoreComponent {
  const vs = computeSourceValueScore(s);
  if (vs.composite === "UNKNOWN") {
    // Partial EIG from known coverage × access only
    if (typeof vs.coverage_score === "number" && typeof vs.access_score === "number") {
      return Math.min(1, vs.coverage_score * 0.6 + vs.access_score * 0.4);
    }
    return "UNKNOWN";
  }
  let bonus = 0;
  if (s.marketsSupported.includes("corners")) bonus += 0.1;
  if (s.marketsSupported.includes("cards")) bonus += 0.1;
  if (s.injuries) bonus += 0.05;
  if (s.lineups) bonus += 0.05;
  if (s.odds && s.historicalDepth) bonus += 0.1;
  return Math.min(1, vs.composite + bonus);
}

function estimateCost(s: SourceIntelligence): ScoreComponent {
  if (s.implementation === "implemented") return 0.1;
  if (s.access === "licensed_feed" || s.licensing === "commercial") return 0.95;
  if (s.access === "public_web") return 0.7; // scraping DENY → high process cost
  if (s.access === "dataset" && (s.licensing === "open" || s.licensing === "research")) {
    return 0.25;
  }
  if (s.access === "public_api" || s.access === "official_api") {
    return s.licensing === "free_api" || s.licensing === "open" ? 0.35 : 0.6;
  }
  if (s.implementation === "blocked") return 0.8;
  return "UNKNOWN";
}

export function rankAcquisitionPriorities(
  catalog: readonly SourceIntelligence[],
  limit = 20,
): AcquisitionPriority[] {
  const rows: AcquisitionPriority[] = [];
  for (const s of catalog) {
    const eig = estimateEig(s);
    const cost = estimateCost(s);
    const rationale: string[] = [];
    if (s.tier === "A" && s.licensing === "commercial") {
      rationale.push("high_info_but_commercial_€0_blocked");
    }
    if (s.implementation === "blocked") rationale.push("live_blocked_offline_possible");
    if (s.marketsSupported.includes("corners")) rationale.push("unlocks_corners_markets");
    if (typeof eig === "number" && typeof cost === "number" && cost > 0) {
      rows.push({
        sourceId: s.id,
        expected_information_gain: eig,
        implementation_cost: cost,
        priority_ratio: eig / cost,
        rationale,
      });
    } else {
      rows.push({
        sourceId: s.id,
        expected_information_gain: eig,
        implementation_cost: cost,
        priority_ratio: "UNKNOWN",
        rationale: [...rationale, "ratio_unknown_missing_components"],
      });
    }
  }
  rows.sort((a, b) => {
    const ra = typeof a.priority_ratio === "number" ? a.priority_ratio : -1;
    const rb = typeof b.priority_ratio === "number" ? b.priority_ratio : -1;
    return rb - ra;
  });
  return rows.slice(0, limit);
}
