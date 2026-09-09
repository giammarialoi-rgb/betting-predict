import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask049 } from "@/domain/eval/factory-049/audit";
import type { Task049Report } from "@/domain/eval/factory-049/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const p = join(process.cwd(), "artifacts", "task-049", "task-049-result.json");
  const report = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Task049Report) : null;
  const result = auditTask049(report);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
