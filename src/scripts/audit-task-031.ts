import { auditTask031 } from "@/domain/eval/breakthrough-031/audit";
import { loadTask031ReportForUi, runTask031 } from "@/domain/eval/breakthrough-031/lab";

async function main() {
  const report = loadTask031ReportForUi() ?? (await runTask031({ skipHeavy: true }));
  const audit = auditTask031(report);
  console.log(JSON.stringify({ ...audit, verdict: report.verdict, strict_events: report.strict_events }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
