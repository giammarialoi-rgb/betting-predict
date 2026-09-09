import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask044 } from "@/domain/eval/permanent-044/audit";
import type { Task044Report } from "@/domain/eval/permanent-044/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-044", "task-044-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task044Report) : null;
  const result = auditTask044(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
