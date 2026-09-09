import { auditTask027 } from "@/domain/eval/breakthrough-027/audit";
import { loadTask027ReportForUi, runTask027 } from "@/domain/eval/breakthrough-027/lab";

async function main() {
  const report = loadTask027ReportForUi() ?? (await runTask027({ allowNetwork: false, skipHeavy: true }));
  const audit = auditTask027(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
