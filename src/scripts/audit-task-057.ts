import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditTask057 } from "@/domain/data-sources/api-sports/audit";
import type { Task057Report } from "@/domain/data-sources/api-sports/lab";

config({ path: ".env.local" });
config({ path: ".env" });

function main() {
  const p = join(process.cwd(), "artifacts", "task-057", "task-057-result.json");
  if (!existsSync(p)) {
    console.error("Missing artifacts/task-057/task-057-result.json — run pnpm lab:task-057 first");
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(p, "utf8")) as Task057Report;
  const audit = auditTask057(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main();
