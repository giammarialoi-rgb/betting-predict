/**
 * Atomic PID lock helpers — reduce TOCTOU races for supervisor/worker.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync, writeSync } from "node:fs";

export type PidLock054 = { pid: number; started_at: string; role: string };

export function pidAlive054(pid: number | null | undefined): boolean {
  if (pid == null || !Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readPidLock054(path: string): PidLock054 | null {
  if (!existsSync(path)) return null;
  try {
    const j = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as PidLock054;
    if (!j?.pid) return null;
    return j;
  } catch {
    return null;
  }
}

/** Try exclusive create; if stale lock (dead pid), replace. */
export function acquirePidLock054(path: string, role: string): { ok: true; lock: PidLock054 } | { ok: false; reason: string; holder: PidLock054 | null } {
  const existing = readPidLock054(path);
  if (existing && pidAlive054(existing.pid)) {
    if (existing.pid === process.pid) {
      return { ok: true, lock: existing };
    }
    return { ok: false, reason: "held_by_alive_pid", holder: existing };
  }
  // Stale or missing — try exclusive create first
  const lock: PidLock054 = { pid: process.pid, started_at: new Date().toISOString(), role };
  try {
    if (!existing) {
      const fd = openSync(path, "wx");
      writeSync(fd, JSON.stringify(lock));
      closeSync(fd);
      return { ok: true, lock };
    }
  } catch {
    // race: someone else created — re-read
    const again = readPidLock054(path);
    if (again && pidAlive054(again.pid) && again.pid !== process.pid) {
      return { ok: false, reason: "race_lost", holder: again };
    }
  }
  writeFileSync(path, JSON.stringify(lock));
  return { ok: true, lock };
}

export function releasePidLock054(path: string): void {
  const existing = readPidLock054(path);
  if (existing && existing.pid !== process.pid) return;
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

/** Kill only if lock PID is alive and role is worker (or legacy lock without role). */
export function terminateOrphanWorker054(path: string, expectedRole = "worker"): boolean {
  const lock = readPidLock054(path);
  if (!lock) return false;
  if (lock.role && lock.role !== expectedRole) return false;
  if (!pidAlive054(lock.pid)) {
    try {
      unlinkSync(path);
    } catch {
      /* */
    }
    return false;
  }
  try {
    process.kill(lock.pid, "SIGTERM");
  } catch {
    try {
      process.kill(lock.pid);
    } catch {
      return false;
    }
  }
  return true;
}
