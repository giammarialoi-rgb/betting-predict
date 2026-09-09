import { loadTask020ReportForUi } from "@/domain/eval/capital-020/lab";
import { auditTask020 } from "@/domain/eval/capital-020/audit";

function main() {
  const report = loadTask020ReportForUi();
  const audit = auditTask020(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main();
