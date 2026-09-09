/**
 * Permanent-live supervisor — 24/7 self-healing (independent of Cursor).
 */

import { config } from "dotenv";
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadBrainState051, saveBrainState051 } from "@/domain/eval/brain-051/config";
import {
  acquireSupervisorLock054,
  releaseSupervisorLock054,
  healOnce054,
  recoverStoreSnapshot054,
} from "@/domain/eval/supervisor-054/heal";
import {
  appendSupervisorJournal054,
  ensureSupervisorDirs054,
  loadSupervisorState054,
  saveSupervisorState054,
  writeRichHeartbeat054,
} from "@/domain/eval/supervisor-054/state";

config({ path: ".env.local" });
config({ path: ".env" });

const root = permanentRoot044();
ensurePermanentDirs044(root);
ensureSupervisorDirs054(root);

const mode = process.argv[2] ?? "run";
let stopping = false;

async function runLoop() {
  const acquired = acquireSupervisorLock054(root);
  if (!acquired.ok) {
    console.log(JSON.stringify({ ok: false, error: "supervisor_already_running", holder: acquired.holder }));
    process.exit(2);
  }

  const started = new Date().toISOString();
  let state = loadSupervisorState054(root);
  state = {
    ...state,
    supervisor_pid: process.pid,
    started_at: state.started_at ?? started,
    status: "NORMAL",
  };
  saveSupervisorState054(root, state);

  const brain = loadBrainState051(root);
  saveBrainState051(root, { ...brain, watchdog_pid: process.pid });

  appendSupervisorJournal054(root, "WORKER_STARTED", `supervisor_pid=${process.pid}`);
  const snap = recoverStoreSnapshot054(root);
  appendSupervisorJournal054(root, "RECOVERY_STARTED", "store_snapshot", snap);

  // Immediate heal if worker dead
  await healOnce054({ root, waitMs: 8000 });

  const shutdown = () => {
    stopping = true;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    while (!stopping) {
      writeRichHeartbeat054(root, {
        pid: process.pid,
        started_at: started,
        heartbeat_at: new Date().toISOString(),
        last_cycle_at: loadBrainState051(root).last_cycle_at,
        last_successful_cycle_at: loadBrainState051(root).last_successful_cycle_at,
        phase: "supervisor_tick",
        sport: null,
        event_id: null,
        market: null,
        api_state: null,
        budget_state: loadBrainState051(root).status === "PAUSED_BUDGET" ? "PAUSED" : "OK",
        current_operation: "heal_tick",
        role: "supervisor",
      });

      const result = await healOnce054({ root, waitMs: 6000 });
      state = loadSupervisorState054(root);
      state = { ...state, supervisor_pid: process.pid };
      saveSupervisorState054(root, state);
      saveBrainState051(root, { ...loadBrainState051(root), watchdog_pid: process.pid });

      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          action: result.action,
          status: result.state.status,
          worker_pid: result.new_worker_pid,
          reason: result.assessment.reason,
        }),
      );

      for (let i = 0; i < 12 && !stopping; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  } finally {
    state = loadSupervisorState054(root);
    saveSupervisorState054(root, { ...state, supervisor_pid: null, status: "IDLE" });
    saveBrainState051(root, { ...loadBrainState051(root), watchdog_pid: null });
    releaseSupervisorLock054(root);
    appendSupervisorJournal054(root, "WORKER_STOPPED", "supervisor_exit");
  }
}

async function main() {
  if (mode === "status") {
    const state = loadSupervisorState054(root);
    const { assessWorkerHealth054 } = await import("@/domain/eval/supervisor-054/heal");
    const a = assessWorkerHealth054(root);
    console.log(JSON.stringify({ supervisor: state, assessment: a, store: recoverStoreSnapshot054(root) }, null, 2));
    return;
  }
  if (mode === "recover") {
    const acquired = acquireSupervisorLock054(root);
    if (!acquired.ok) {
      console.log(JSON.stringify({ ok: false, error: "supervisor_lock_held", holder: acquired.holder }));
      process.exit(2);
    }
    try {
      const r = await healOnce054({ root, waitMs: 10000 });
      console.log(JSON.stringify({ ok: true, ...r, store: recoverStoreSnapshot054(root) }, null, 2));
    } finally {
      releaseSupervisorLock054(root);
    }
    return;
  }
  if (mode === "logs") {
    const { readFileSync, existsSync } = await import("node:fs");
    const { supervisorJournalPath054 } = await import("@/domain/eval/supervisor-054/state");
    const p = supervisorJournalPath054(root);
    if (!existsSync(p)) {
      console.log("(no journal)");
      return;
    }
    console.log(
      readFileSync(p, "utf8")
        .split(/\n/)
        .filter(Boolean)
        .slice(-80)
        .join("\n"),
    );
    return;
  }
  // run
  await runLoop();
}

main().catch((e) => {
  console.error(e);
  try {
    releaseSupervisorLock054(root);
  } catch {
    /* */
  }
  process.exit(1);
});
