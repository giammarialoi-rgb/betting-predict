import { loadTask021ReportForUi } from "@/domain/eval/capital-021/lab";
import { auditTask021 } from "@/domain/eval/capital-021/audit";

function main() {
  const report = loadTask021ReportForUi();
  const audit = auditTask021(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main();
