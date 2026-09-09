import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { runMassive049Cycle } from "@/domain/eval/factory-049/cycle";
import { appendJournal044, writeCheckpoint044 } from "@/domain/eval/permanent-044/store";

config({ path: ".env.local" });
config({ path: ".env" });

const root = permanentRoot044();
ensurePermanentDirs044(root);
const lockPath = join(root, "collector.lock");
const statusPath = join(root, "collector-status.json");
const logPath = join(root, "collector.log");

function log(msg: string) {
  mkdirSync(root, { recursive: true });
  writeFileSync(logPath, `${new Date().toISOString()} ${msg}\n`, { flag: "a" });
  console.log(msg);
}

function saveStatus(s: Record<string, unknown>) {
  writeFileSync(statusPath, JSON.stringify({ ...s, updated_at: new Date().toISOString() }, null, 2));
}

function acquire(): boolean {
  if (existsSync(lockPath)) {
    try {
      const j = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
      try {
        process.kill(j.pid, 0);
        return false;
      } catch {
        /* stale */
      }
    } catch {
      /* ignore */
    }
  }
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
  return true;
}

function release() {
  if (existsSync(lockPath)) unlinkSync(lockPath);
}

let stopping = false;
let cycleN = 0;

async function main() {
  if (!acquire()) {
    console.log(JSON.stringify({ ok: false, error: "permanent_live_already_running" }));
    process.exit(2);
  }
  log(`daemon_start pid=${process.pid} factory-049`);
  saveStatus({ status: "RUNNING", pid: process.pid });
  const shutdown = () => {
    stopping = true;
    log("daemon_stop_signal");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    while (!stopping) {
      cycleN += 1;
      const discover = cycleN === 1 || cycleN % 4 === 0;
      const result = await runMassive049Cycle({
        discover,
        settle: true,
        forceDiscovery: cycleN === 1,
      });
      writeCheckpoint044(root, {
        last_cycle: result.stats,
        cycleN,
        discovery: result.discovery,
      });
      appendJournal044(root, {
        kind: "daemon_factory_049",
        cycleN,
        events: result.stats.EVENTS_ANALYZED,
        NO_BET: result.stats.NO_BET,
        skipped_discovery: result.skipped_discovery,
      });
      saveStatus({
        status: "RUNNING",
        pid: process.pid,
        last_cycle_at: new Date().toISOString(),
        stats: result.stats,
        sport_coverage: result.discovery?.families,
      });
      log(
        `cycle ${cycleN} analyzed=${result.stats.EVENTS_ANALYZED} soccer=${result.stats.SOCCER} basket=${result.stats.BASKETBALL} skip=${result.skipped_discovery}`,
      );
      for (let i = 0; i < 90 && !stopping; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  } finally {
    saveStatus({ status: "STOPPED", pid: null });
    release();
    log("daemon_exit");
  }
}

main().catch((e) => {
  log(`fatal ${e instanceof Error ? e.message : String(e)}`);
  saveStatus({ status: "PAUSED_ERROR", error: String(e) });
  release();
  process.exit(1);
});
