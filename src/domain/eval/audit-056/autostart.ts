/**
 * Autostart status normalization for TASK 056.
 * TASK_SCHEDULER | STARTUP_FOLDER | DISABLED — never claim success if unverified.
 */

import { loadAutostartStatus055, runVerifyAutostart055 } from "@/domain/eval/catalog-055/autostart";

export type AutostartCanonical056 = "TASK_SCHEDULER" | "STARTUP_FOLDER" | "DISABLED";

export function canonicalizeAutostart056(mechanism: string | null | undefined, verified: boolean): AutostartCanonical056 {
  if (!verified) return "DISABLED";
  const m = (mechanism ?? "").toLowerCase();
  if (m.includes("taskscheduler") && m.includes("startup")) return "TASK_SCHEDULER"; // both → prefer scheduler as primary
  if (m.includes("taskscheduler") || m === "taskscheduleronly") return "TASK_SCHEDULER";
  if (m.includes("startup") || m === "startuponly") return "STARTUP_FOLDER";
  return "DISABLED";
}

export function resolveAutostart056(verify = false): {
  AUTOSTART_STATUS: AutostartCanonical056;
  AUTOSTART_VERIFIED: boolean;
  ACTIVE_MECHANISM: string;
  path_contains_spaces: boolean;
} {
  const status = verify ? runVerifyAutostart055() : loadAutostartStatus055();
  const verified = Boolean(status?.AUTOSTART_VERIFIED);
  const mechanism = status?.ACTIVE_MECHANISM ?? "NONE";
  return {
    AUTOSTART_STATUS: canonicalizeAutostart056(mechanism, verified),
    AUTOSTART_VERIFIED: verified,
    ACTIVE_MECHANISM: mechanism,
    path_contains_spaces: Boolean(status?.path_contains_spaces ?? /\s/.test(process.cwd())),
  };
}
