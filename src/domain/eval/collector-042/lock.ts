import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { processLockPath042 } from "@/domain/eval/collector-042/config";

export type ProcessLock042 = {
  pid: number;
  startedAt: string;
  host: string;
};

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readProcessLock042(root?: string): ProcessLock042 | null {
  const path = processLockPath042(root);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ProcessLock042;
  } catch {
    return null;
  }
}

export function acquireProcessLock042(root?: string): { ok: true; lock: ProcessLock042 } | { ok: false; existing: ProcessLock042 } {
  const existing = readProcessLock042(root);
  if (existing && pidAlive(existing.pid) && existing.pid !== process.pid) {
    return { ok: false, existing };
  }
  const lock: ProcessLock042 = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    host: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "local",
  };
  const path = processLockPath042(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(lock, null, 2));
  return { ok: true, lock };
}

export function releaseProcessLock042(root?: string): void {
  const path = processLockPath042(root);
  const existing = readProcessLock042(root);
  if (existing && existing.pid !== process.pid) return;
  if (existsSync(path)) unlinkSync(path);
}

export function isLockHeldByAliveProcess042(root?: string): boolean {
  const existing = readProcessLock042(root);
  return Boolean(existing && pidAlive(existing.pid));
}
