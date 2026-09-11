/**
 * Engine discovery: live allowlist plus first-class blocked/policy stubs.
 * Kept out of catalog.ts to avoid a catalog ↔ blocked-audit import cycle.
 */
import { discoverFreeSourceJobs } from "@/domain/eval/acquisition-engine/catalog";
import { BLOCKED_ENGINE_SOURCES } from "@/domain/eval/acquisition-engine/sources/blocked";
import { POLICY_ENGINE_SOURCES } from "@/domain/eval/acquisition-engine/sources/policy";
import type { AcquisitionJob } from "@/domain/eval/acquisition-engine/types";

export function discoverEngineJobs(nowIso = new Date().toISOString()): AcquisitionJob[] {
  const jobs = discoverFreeSourceJobs(nowIso);
  const seen = new Set(jobs.map((j) => j.source_id));
  for (const s of BLOCKED_ENGINE_SOURCES) {
    if (seen.has(s.source_id)) continue;
    jobs.push({
      source_id: s.source_id,
      kind: "catalog",
      url: s.url,
      label: `${s.source_id}:blocked`,
    });
    seen.add(s.source_id);
  }
  for (const s of POLICY_ENGINE_SOURCES) {
    if (seen.has(s.source_id)) continue;
    jobs.push({
      source_id: s.source_id,
      kind: s.kind,
      url: s.url,
      label: `${s.source_id}:policy`,
    });
    seen.add(s.source_id);
  }
  return jobs;
}
