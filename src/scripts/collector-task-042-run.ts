import { config } from "dotenv";
import { spawn } from "node:child_process";
import { runCollectorCycle042 } from "@/domain/eval/collector-042/cycle";
import { loadGovernorConfig042, sourceStore042 } from "@/domain/eval/collector-042/config";
import { acquireProcessLock042, releaseProcessLock042 } from "@/domain/eval/collector-042/lock";
import { loadHeartbeat042, saveHeartbeat042 } from "@/domain/eval/collector-042/heartbeat";
import { loadMeta042 } from "@/domain/eval/collector-042/cycle";
import { appendCollectorLog042 } from "@/domain/eval/collector-042/log";

config({ path: ".env.local" });
config({ path: ".env" });

let stopping = false;

async function triggerLab(): Promise<void> {
  const child = spawn("pnpm", ["lab:task-041"], {
    cwd: process.cwd(),
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const root = sourceStore042();
  const lock = acquireProcessLock042(root);
  if (!lock.ok) {
    console.log(JSON.stringify({ ok: false, error: "collector_already_running", pid: lock.existing.pid }));
    process.exit(2);
  }

  const startedAt = new Date().toISOString();
  appendCollectorLog042(`daemon_start pid=${process.pid}`, root);
  saveHeartbeat042(
    {
      ...loadHeartbeat042(root),
      status: "RUNNING",
      pid: process.pid,
      startedAt,
      lastError: null,
      pausedReason: null,
    },
    root,
  );

  const shutdown = () => {
    stopping = true;
    appendCollectorLog042(`daemon_stop_signal pid=${process.pid}`, root);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    while (!stopping) {
      const cfg = loadGovernorConfig042();
      const meta = loadMeta042(root);
      const result = await runCollectorCycle042({ storeRoot: root, triggerLab });
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          status: result.status,
          settled: result.settled,
          reason: result.reason,
          skipped: result.skipped,
        }),
      );
      if (result.status === "COMPLETED" || result.status === "PAUSED_ERROR") {
        if (result.status === "PAUSED_ERROR") {
          await sleep(Math.max(meta.backoffMs, 60_000));
          if (stopping) break;
          continue;
        }
        break;
      }
      const wait = Math.max(cfg.pollMinutes * 60_000, meta.backoffMs || 0, 5_000);
      const hb = loadHeartbeat042(root);
      saveHeartbeat042(
        {
          ...hb,
          status: result.status === "PAUSED_BUDGET" ? "PAUSED_BUDGET" : "RUNNING",
          nextPullAt: new Date(Date.now() + wait).toISOString(),
          pid: process.pid,
        },
        root,
      );
      const step = 5_000;
      let left = wait;
      while (left > 0 && !stopping) {
        await sleep(Math.min(step, left));
        left -= step;
        // heartbeat tick while waiting
        const cur = loadHeartbeat042(root);
        saveHeartbeat042({ ...cur, pid: process.pid, heartbeatAt: new Date().toISOString() }, root);
      }
      if (result.status === "PAUSED_BUDGET") {
        // keep process alive but slow; budget may reset next month
        continue;
      }
    }
  } finally {
    const hb = loadHeartbeat042(root);
    saveHeartbeat042(
      {
        ...hb,
        status: hb.status === "COMPLETED" ? "COMPLETED" : "STOPPED",
        pid: null,
      },
      root,
    );
    releaseProcessLock042(root);
    appendCollectorLog042(`daemon_exit pid=${process.pid}`, root);
  }
}

main().catch((err) => {
  console.error(err);
  releaseProcessLock042();
  process.exit(1);
});
