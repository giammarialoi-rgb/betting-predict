import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask046 } from "@/domain/eval/control-046/audit";
import type { Task046Report } from "@/domain/eval/control-046/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-046", "task-046-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task046Report) : null;
  const result = auditTask046(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
