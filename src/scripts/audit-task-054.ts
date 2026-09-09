import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask054Supervisor } from "@/domain/eval/supervisor-054/audit";
import type { Task054SupervisorReport } from "@/domain/eval/supervisor-054/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-054", "supervisor-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task054SupervisorReport) : null;
  const result = auditTask054Supervisor(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
