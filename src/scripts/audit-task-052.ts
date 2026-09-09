import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask052 } from "@/domain/eval/ui-052/audit";
import type { Task052Report } from "@/domain/eval/ui-052/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-052", "task-052-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task052Report) : null;
  const result = auditTask052(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
