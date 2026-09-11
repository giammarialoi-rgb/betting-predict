/**
 * Engine discovery: live allowlist only.
 * WAF/policy stubs are not queued and are not listed as consulted Fonti.
 */
import { discoverFreeSourceJobs } from "@/domain/eval/acquisition-engine/catalog";
import type { AcquisitionJob } from "@/domain/eval/acquisition-engine/types";

export function discoverEngineJobs(nowIso = new Date().toISOString()): AcquisitionJob[] {
  return discoverFreeSourceJobs(nowIso);
}
