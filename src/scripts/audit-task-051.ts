import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask051 } from "@/domain/eval/brain-051/audit";
import type { Task051Report } from "@/domain/eval/brain-051/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-051", "task-051-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task051Report) : null;
  const result = auditTask051(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
