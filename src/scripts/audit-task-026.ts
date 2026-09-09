import { auditTask026 } from "@/domain/eval/bottleneck-026/audit";
import { loadTask026ReportForUi, runTask026 } from "@/domain/eval/bottleneck-026/lab";

async function main() {
  const report = loadTask026ReportForUi() ?? (await runTask026({ allowNetwork: false, skipHeavy: true }));
  const audit = auditTask026(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
