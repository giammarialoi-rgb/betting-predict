import { auditTask037 } from "@/domain/eval/harvest-037/audit";
import { loadTask037ReportForUi, runTask037 } from "@/domain/eval/harvest-037/lab";

async function main() {
  const report = loadTask037ReportForUi() ?? (await runTask037({ skipHeavy: true }));
  const audit = auditTask037(report);
  console.log(JSON.stringify({ ok: audit.ok, failures: audit.failures, BETS: report.BETS, BANKROLL: report.BANKROLL }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
