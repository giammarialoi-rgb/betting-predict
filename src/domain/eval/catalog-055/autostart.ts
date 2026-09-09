/**
 * Autostart status — disk-only, no false READY.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type AutostartStatus055 = {
  at: string;
  AUTOSTART_INSTALLED: boolean;
  AUTOSTART_VERIFIED: boolean;
  ACTIVE_MECHANISM: "TaskScheduler+Startup" | "TaskSchedulerOnly" | "StartupOnly" | "NONE" | string;
  path_contains_spaces: boolean;
  start_script: string;
  note: string | null;
  open_task_056: false;
};

export function autostartStatusPath055(root = permanentRoot044()): string {
  return join(root, "supervisor", "autostart-status.json");
}

export function loadAutostartStatus055(root = permanentRoot044()): AutostartStatus055 | null {
  const p = autostartStatusPath055(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as AutostartStatus055;
  } catch {
    return null;
  }
}

/** Run verify-autostart.ps1 and reload status from disk. */
export function runVerifyAutostart055(repoRoot = process.cwd()): AutostartStatus055 {
  const script = join(repoRoot, "scripts", "verify-autostart.ps1");
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-RepoRoot", repoRoot],
    { encoding: "utf8", cwd: repoRoot },
  );
  const loaded = loadAutostartStatus055();
  if (loaded) return loaded;
  const fallback: AutostartStatus055 = {
    at: new Date().toISOString(),
    AUTOSTART_INSTALLED: false,
    AUTOSTART_VERIFIED: false,
    ACTIVE_MECHANISM: "NONE",
    path_contains_spaces: /\s/.test(repoRoot),
    start_script: join(repoRoot, "scripts", "start-supervisor.ps1"),
    note: r.stderr || r.stdout || "verify failed",
    open_task_056: false,
  };
  mkdirSync(join(permanentRoot044(), "supervisor"), { recursive: true });
  writeFileSync(autostartStatusPath055(), JSON.stringify(fallback, null, 2));
  return fallback;
}

/** Path-quoting unit check — spaces must be inside quotes for -File. */
export function assertFileArgQuoted055(args: string, scriptBasename: string): boolean {
  const re = new RegExp(`-File\\s+"[^"]*${scriptBasename.replace(".", "\\.")}"`, "i");
  return re.test(args);
}
