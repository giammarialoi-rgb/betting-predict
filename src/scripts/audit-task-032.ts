import { auditTask032 } from "@/domain/eval/incremental-032/audit";
import { loadTask032ReportForUi, runTask032 } from "@/domain/eval/incremental-032/lab";

async function main() {
  const report = loadTask032ReportForUi() ?? (await runTask032({ skipHeavy: true }));
  const audit = auditTask032(report);
  console.log(
    JSON.stringify(
      { ...audit, verdict: report.verdict, HOLDOUT_STATUS: report.HOLDOUT_STATUS, qualified: report.qualified },
      null,
      2,
    ),
  );
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
