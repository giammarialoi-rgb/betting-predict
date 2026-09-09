import { config } from "dotenv";
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import {
  ensureBrainDirs051,
  brainWorkerLockPath051,
  loadBrainState051,
  saveBrainState051,
} from "@/domain/eval/brain-051/config";
import { runBrainCycle051 } from "@/domain/eval/brain-051/cycle";
import { appendBrainLog051 } from "@/domain/eval/brain-051/health";
import { acquirePidLock054, releasePidLock054 } from "@/domain/eval/supervisor-054/locks";
import { writeRichHeartbeat054 } from "@/domain/eval/supervisor-054/state";
import { writeCurrentWork053 } from "@/domain/eval/bankroll-053/system";

config({ path: ".env.local" });
config({ path: ".env" });

const root = permanentRoot044();
ensurePermanentDirs044(root);
ensureBrainDirs051(root);
const lockPath = brainWorkerLockPath051(root);

let stopping = false;

async function main() {
  const acquired = acquirePidLock054(lockPath, "worker");
  if (!acquired.ok) {
    console.log(JSON.stringify({ ok: false, error: "brain_worker_already_running", holder: acquired.holder }));
    process.exit(2);
  }
  const started = new Date().toISOString();
  let state = loadBrainState051(root);
  state = {
    ...state,
    status: "RUNNING",
    worker_pid: process.pid,
    started_at: started,
    uptime_started_at: state.uptime_started_at ?? started,
  };
  saveBrainState051(root, state);
  appendBrainLog051(root, `worker_start pid=${process.pid}`);
  writeRichHeartbeat054(root, {
    pid: process.pid,
    started_at: started,
    heartbeat_at: new Date().toISOString(),
    last_cycle_at: state.last_cycle_at,
    last_successful_cycle_at: state.last_successful_cycle_at,
    phase: "start",
    sport: null,
    event_id: null,
    market: null,
    api_state: "OK",
    budget_state: "OK",
    current_operation: "boot",
    role: "worker",
  });

  const shutdown = () => {
    stopping = true;
    appendBrainLog051(root, "worker_stop_signal");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    while (!stopping) {
      writeCurrentWork053({
        sport: "MULTI",
        event: null,
        market: null,
        phase: "CYCLE",
        started_at: new Date().toISOString(),
        last_update: new Date().toISOString(),
        note: "brain cycle",
      });
      writeRichHeartbeat054(root, {
        pid: process.pid,
        started_at: started,
        heartbeat_at: new Date().toISOString(),
        last_cycle_at: loadBrainState051(root).last_cycle_at,
        last_successful_cycle_at: loadBrainState051(root).last_successful_cycle_at,
        phase: "cycle",
        sport: "MULTI",
        event_id: null,
        market: null,
        api_state: "OK",
        budget_state: loadBrainState051(root).status === "PAUSED_BUDGET" ? "PAUSED" : "OK",
        current_operation: "runBrainCycle051",
        role: "worker",
      });

      let result: Awaited<ReturnType<typeof runBrainCycle051>>;
      try {
        result = await runBrainCycle051({ allowDiscover: true });
      } catch (cycleErr) {
        const msg = cycleErr instanceof Error ? cycleErr.message : String(cycleErr);
        appendBrainLog051(root, `cycle_error_recovered ${msg}`);
        const st = loadBrainState051(root);
        saveBrainState051(root, {
          ...st,
          status: "RUNNING",
          last_error: msg,
          consecutive_errors: st.consecutive_errors + 1,
          worker_pid: process.pid,
        });
        writeRichHeartbeat054(root, {
          pid: process.pid,
          started_at: started,
          heartbeat_at: new Date().toISOString(),
          last_cycle_at: st.last_cycle_at,
          last_successful_cycle_at: st.last_successful_cycle_at,
          phase: "cycle_error",
          sport: null,
          event_id: null,
          market: null,
          api_state: "ERROR",
          budget_state: "OK",
          current_operation: "backoff",
          role: "worker",
        });
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }

      appendBrainLog051(
        root,
        `cycle priority=${result.priority} sleep_ms=${result.sleep_ms} idle=${result.idle}`,
      );
      const slices = Math.max(1, Math.ceil(result.sleep_ms / 10_000));
      for (let i = 0; i < slices && !stopping; i++) {
        writeRichHeartbeat054(root, {
          pid: process.pid,
          started_at: started,
          heartbeat_at: new Date().toISOString(),
          last_cycle_at: loadBrainState051(root).last_cycle_at,
          last_successful_cycle_at: loadBrainState051(root).last_successful_cycle_at,
          phase: result.idle ? "idle_sleep" : "sleep",
          sport: null,
          event_id: null,
          market: null,
          api_state: "OK",
          budget_state: "OK",
          current_operation: `sleep_${result.priority}`,
          role: "worker",
        });
        writeCurrentWork053({
          sport: null,
          event: null,
          market: null,
          phase: result.idle ? "IDLE" : "SLEEP",
          started_at: started,
          last_update: new Date().toISOString(),
          note: `priority=${result.priority}`,
        });
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  } finally {
    state = loadBrainState051(root);
    saveBrainState051(root, { ...state, status: "STOPPED", worker_pid: null });
    releasePidLock054(lockPath);
    appendBrainLog051(root, "worker_exit");
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  appendBrainLog051(root, `worker_fatal ${msg}`);
  const state = loadBrainState051(root);
  saveBrainState051(root, {
    ...state,
    status: "ERROR",
    last_error: msg,
    worker_pid: null,
  });
  releasePidLock054(lockPath);
  process.exit(1);
});
