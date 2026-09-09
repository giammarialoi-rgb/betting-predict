import { config } from "dotenv";
import { spawn } from "node:child_process";
import { runCollectorCycle042 } from "@/domain/eval/collector-042/cycle";
import { loadGovernorConfig042, sourceStore042 } from "@/domain/eval/collector-042/config";
import { acquireProcessLock042, releaseProcessLock042 } from "@/domain/eval/collector-042/lock";
import { loadHeartbeat042, saveHeartbeat042 } from "@/domain/eval/collector-042/heartbeat";
import { remainingCredits042 } from "@/domain/eval/collector-042/credit";

config({ path: ".env.local" });
config({ path: ".env" });

async function triggerLab(): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn("pnpm", ["lab:task-041"], {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    resolve();
  });
}

async function main() {
  const root = sourceStore042();
  const lock = acquireProcessLock042(root);
  if (!lock.ok) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "collector_already_running",
        pid: lock.existing.pid,
        startedAt: lock.existing.startedAt,
      }),
    );
    process.exit(2);
  }
  try {
    const hb = loadHeartbeat042(root);
    saveHeartbeat042(
      {
        ...hb,
        status: "RUNNING",
        pid: process.pid,
        startedAt: hb.startedAt ?? new Date().toISOString(),
        pausedReason: null,
      },
      root,
    );
    const result = await runCollectorCycle042({
      storeRoot: root,
      triggerLab,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "once",
          status: result.status,
          skipped: result.skipped,
          reason: result.reason,
          discovery: result.discovery,
          scores: result.scores,
          lockedNew: result.lockedNew,
          settled: result.settled,
          remainingCredits: remainingCredits042(result.credit),
          pollMinutes: loadGovernorConfig042().pollMinutes,
        },
        null,
        2,
      ),
    );
  } finally {
    const hb = loadHeartbeat042(root);
    if (hb.status === "RUNNING" || hb.status === "READY_TO_SETTLE") {
      saveHeartbeat042({ ...hb, status: "STOPPED", pid: null }, root);
    }
    releaseProcessLock042(root);
  }
}

main().catch((err) => {
  console.error(err);
  releaseProcessLock042();
  process.exit(1);
});
