import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask053 } from "@/domain/eval/bankroll-053/audit";
import type { Task053Report } from "@/domain/eval/bankroll-053/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-053", "task-053-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task053Report) : null;
  const result = auditTask053(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
