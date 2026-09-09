/**
 * Brain watchdog — delegates to supervisor-054 heal (cooldown + single worker).
 */

import { config } from "dotenv";
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { ensureBrainDirs051, loadBrainState051, saveBrainState051 } from "@/domain/eval/brain-051/config";
import {
  acquireSupervisorLock054,
  releaseSupervisorLock054,
  healOnce054,
} from "@/domain/eval/supervisor-054/heal";
import {
  appendSupervisorJournal054,
  ensureSupervisorDirs054,
  loadSupervisorState054,
  saveSupervisorState054,
} from "@/domain/eval/supervisor-054/state";
import { appendBrainLog051 } from "@/domain/eval/brain-051/health";

config({ path: ".env.local" });
config({ path: ".env" });

const root = permanentRoot044();
ensurePermanentDirs044(root);
ensureBrainDirs051(root);
ensureSupervisorDirs054(root);

let stopping = false;

async function main() {
  const acquired = acquireSupervisorLock054(root);
  if (!acquired.ok) {
    console.log(JSON.stringify({ ok: false, error: "brain_watchdog_already_running", holder: acquired.holder }));
    process.exit(2);
  }

  let state = loadSupervisorState054(root);
  state = { ...state, supervisor_pid: process.pid, started_at: state.started_at ?? new Date().toISOString() };
  saveSupervisorState054(root, state);
  saveBrainState051(root, { ...loadBrainState051(root), watchdog_pid: process.pid });
  appendBrainLog051(root, `watchdog_start pid=${process.pid} supervisor-054`);
  appendSupervisorJournal054(root, "WORKER_STARTED", `watchdog_as_supervisor pid=${process.pid}`);

  const shutdown = () => {
    stopping = true;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await healOnce054({ root, waitMs: 8000 });

  try {
    while (!stopping) {
      const result = await healOnce054({ root, waitMs: 5000 });
      appendBrainLog051(
        root,
        `watchdog_tick action=${result.action} status=${result.state.status} reason=${result.assessment.reason ?? "none"}`,
      );
      saveBrainState051(root, { ...loadBrainState051(root), watchdog_pid: process.pid });
      for (let i = 0; i < 12 && !stopping; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  } finally {
    saveSupervisorState054(root, { ...loadSupervisorState054(root), supervisor_pid: null, status: "IDLE" });
    saveBrainState051(root, { ...loadBrainState051(root), watchdog_pid: null });
    releaseSupervisorLock054(root);
    appendBrainLog051(root, "watchdog_exit");
    appendSupervisorJournal054(root, "WORKER_STOPPED", "watchdog_exit");
  }
}

main().catch((e) => {
  appendBrainLog051(root, `watchdog_fatal ${e instanceof Error ? e.message : String(e)}`);
  releaseSupervisorLock054(root);
  process.exit(1);
});
