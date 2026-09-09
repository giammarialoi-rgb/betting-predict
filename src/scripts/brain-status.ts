import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { buildObservatory051 } from "@/domain/eval/brain-051/observatory";
import { brainDir051 } from "@/domain/eval/brain-051/config";

config({ path: ".env.local" });
config({ path: ".env" });

function main() {
  const mode = process.argv[2] ?? "status";
  const root = permanentRoot044();
  if (mode === "logs") {
    const logPath = join(brainDir051(root), "logs", "brain.log");
    if (!existsSync(logPath)) {
      console.log("(no brain.log yet)");
      return;
    }
    const lines = readFileSync(logPath, "utf8").split(/\n/).filter(Boolean);
    console.log(lines.slice(-80).join("\n"));
    return;
  }
  const obs = buildObservatory051();
  console.log(
    JSON.stringify(
      {
        display: obs.brain_051.display,
        status: obs.brain_051.status,
        pid: obs.brain_051.pid,
        pid_alive: obs.brain_051.pid_alive,
        watchdog_pid: obs.brain_051.watchdog_pid,
        uptime: obs.brain_051.uptime_human,
        heartbeat_at: obs.brain_051.heartbeat_at,
        last_cycle_at: obs.brain_051.last_cycle_at,
        last_successful_cycle_at: obs.brain_051.last_successful_cycle_at,
        last_priority: obs.brain_051.last_priority,
        cycles_completed: obs.brain_051.cycles_completed,
        restart_count: obs.brain_051.restart_count,
        last_error: obs.brain_051.last_error,
        model_version: obs.brain_051.model_version,
        capital: obs.brain_051.capital,
        real_money: obs.brain_051.real_money,
        counters: obs.brain_051.counters,
        health_issues: obs.brain_051.health_issues,
        budget: obs.brain_051.budget,
        store: obs.brain_051.store,
      },
      null,
      2,
    ),
  );
}

main();
