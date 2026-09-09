import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask045 } from "@/domain/eval/factory-045/audit";
import type { Task045Report } from "@/domain/eval/factory-045/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-045", "task-045-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task045Report) : null;
  const result = auditTask045(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
