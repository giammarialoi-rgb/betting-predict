import { runTask018AuditColumns } from "@/domain/eval/actuarial-018/lab";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyAllMatchesColumns } from "@/domain/eval/actuarial-018/column-classification";

async function main() {
  const audit = await runTask018AuditColumns();
  const rows = classifyAllMatchesColumns();
  writeFileSync(
    join(process.cwd(), "docs", "task-018-dataset-audit.md"),
    [
      "# TASK 018 — Dataset Column Audit",
      "",
      "Source: Club-Football-Match-Data Matches.csv (SECONDARY).",
      "",
      "| Column | Semantics | Temporality | Usability | STRICT | Reason |",
      "|--------|-----------|-------------|-----------|--------|--------|",
      ...rows.map(
        (r) =>
          `| ${r.column} | ${r.semantics} | ${r.temporality} | ${r.usability} | ${r.usable_strict ? "YES" : "NO"} | ${r.reason} |`,
      ),
      "",
      "## Summary",
      "",
      "```json",
      JSON.stringify(audit.summary, null, 2),
      "```",
    ].join("\n"),
  );
  console.log(JSON.stringify(audit.summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
