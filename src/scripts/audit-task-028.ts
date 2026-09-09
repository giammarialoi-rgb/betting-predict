import { auditTask028 } from "@/domain/eval/validation-028/audit";
import { loadTask028ReportForUi, runTask028 } from "@/domain/eval/validation-028/lab";

async function main() {
  const report = loadTask028ReportForUi() ?? (await runTask028({ skipHeavy: true }));
  const audit = auditTask028(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
