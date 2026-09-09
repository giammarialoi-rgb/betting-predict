import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask055 } from "@/domain/eval/catalog-055/audit";
import type { Task055Report } from "@/domain/eval/catalog-055/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-055", "task-055-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task055Report) : null;
  const result = auditTask055(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
