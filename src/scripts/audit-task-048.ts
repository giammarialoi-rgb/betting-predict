import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask048 } from "@/domain/eval/factory-048/audit";
import type { Task048Report } from "@/domain/eval/factory-048/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-048", "task-048-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task048Report) : null;
  const result = auditTask048(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
