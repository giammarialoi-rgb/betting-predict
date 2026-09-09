import { huntCsv027, huntRows027 } from "@/domain/eval/breakthrough-027/hunt";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function main() {
  const rows = huntRows027();
  mkdirSync(join(process.cwd(), "docs"), { recursive: true });
  writeFileSync(join(process.cwd(), "docs", "task-027-source-hunt.csv"), huntCsv027(rows));
  console.log(JSON.stringify({ trails: rows.length, sources: rows.map((r) => r.source) }, null, 2));
}

main();
