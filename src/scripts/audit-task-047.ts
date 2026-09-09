import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask047 } from "@/domain/eval/factory-047/audit";
import type { Task047Report } from "@/domain/eval/factory-047/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-047", "task-047-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task047Report) : null;
  const result = auditTask047(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
