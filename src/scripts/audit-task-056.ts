import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { auditTask056 } from "@/domain/eval/audit-056/audit";
import type { Task056Report } from "@/domain/eval/audit-056/lab";

config({ path: ".env.local" });
config({ path: ".env" });

function main() {
  const p = join(process.cwd(), "artifacts", "task-056", "task-056-result.json");
  if (!existsSync(p)) {
    console.error("Missing artifacts/task-056/task-056-result.json — run pnpm lab:task-056 first");
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(p, "utf8")) as Task056Report;
  const audit = auditTask056(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main();
