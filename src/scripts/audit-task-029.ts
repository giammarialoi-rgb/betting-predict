import { auditTask029 } from "@/domain/eval/incremental-029/audit";
import { loadTask029ReportForUi, runTask029 } from "@/domain/eval/incremental-029/lab";

async function main() {
  const report = loadTask029ReportForUi() ?? (await runTask029({ skipHeavy: true }));
  const audit = auditTask029(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
