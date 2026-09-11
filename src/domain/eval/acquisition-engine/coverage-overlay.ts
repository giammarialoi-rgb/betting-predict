/**
 * Overlay last acquisition-engine cycle onto Fonti cards.
 * Honest statuses only — never invents OK from a missing fetch.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { OverlaySourceCard } from "@/domain/eval/betmind-runtime/production-mirror";
import type { SourceEntry } from "@/domain/eval/data-intelligence/types";
import type { AcquisitionCycleResult, SourceLaneResult } from "@/domain/eval/acquisition-engine/types";
import { FREE_SOURCE_CATALOG } from "@/domain/eval/acquisition-engine/catalog";
import { isActiveFontiSource, isPrunedFontiSource } from "@/domain/eval/acquisition-engine/active-fonti";

export function readLastAcquisitionCycle(cwd = process.cwd()): AcquisitionCycleResult | null {
  const path = join(cwd, "artifacts", "acquisition-engine", "last-cycle.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AcquisitionCycleResult;
  } catch {
    return null;
  }
}

function mapLaneStatus(status: SourceLaneResult["status"]): SourceEntry["status"] {
  if (status === "OK") return "ACTIVE";
  if (status === "PARTIAL") return "TEMPORALLY_CAUTIOUS";
  if (status === "AUTH_REQUIRED") return "PLAN_LIMITED";
  if (status === "RATE_LIMITED") return "TEMPORALLY_CAUTIOUS";
  if (status === "BLOCKED") return "UNAVAILABLE";
  if (status === "NO_DATA" || status === "NO_EVENT" || status === "NETWORK_ERROR" || status === "PARSE_ERROR") {
    return "UNAVAILABLE";
  }
  return "CANDIDATE";
}

export function overlayRegistryWithAcquisitionCycle(
  registry: OverlaySourceCard[],
  cycle: AcquisitionCycleResult | null,
): OverlaySourceCard[] {
  if (!cycle) {
    return registry.filter((s) => isActiveFontiSource(s.id) && !isPrunedFontiSource(s.id));
  }
  const byId = new Map(cycle.lanes.map((l) => [l.source_id, l]));
  const seen = new Set<string>();
  const out: OverlaySourceCard[] = registry
    .filter((s) => isActiveFontiSource(s.id) && !isPrunedFontiSource(s.id))
    .map((s) => {
    const lane = byId.get(s.id);
    if (!lane) return s;
    seen.add(s.id);
    return {
      ...s,
      status: mapLaneStatus(lane.status),
      reason: lane.reason_it || s.reason,
      last_attempt: cycle.at,
      last_success: lane.ok ? cycle.at : s.last_success ?? null,
      last_failure: lane.ok ? s.last_failure ?? null : cycle.at,
      events_found: lane.ok ? Math.max(s.events_found ?? 0, lane.records.length) : s.events_found,
      observations_found: lane.fields_extracted.length,
      overlay: "neon_operational",
    };
  });
  for (const lane of cycle.lanes) {
    if (seen.has(lane.source_id)) continue;
    if (!isActiveFontiSource(lane.source_id) || isPrunedFontiSource(lane.source_id)) continue;
    const def = FREE_SOURCE_CATALOG.find((s) => s.source_id === lane.source_id);
    out.push({
      id: lane.source_id,
      title: def?.title_it ?? lane.source_id,
      priority: def?.market_layer ? "high" : "medium",
      role: def?.market_layer ? "MARKET_COMPARE" : "CONTEXT",
      temporal_precision: def?.live ? "STRICT_AS_OF" : "DATE_ONLY",
      status: mapLaneStatus(lane.status),
      reason: lane.reason_it,
      enters_independent_model: false,
      legal_status: "public",
      last_attempt: cycle.at,
      last_success: lane.ok ? cycle.at : null,
      last_failure: lane.ok ? null : cycle.at,
      events_found: lane.ok ? lane.records.length : 0,
      observations_found: lane.fields_extracted.length,
      overlay: "neon_operational",
    });
  }
  return out;
}
