import { loadTask031ReportForUi, runTask031 } from "@/domain/eval/breakthrough-031/lab";
import { renderAnnualBankroll031, writeTask031Artifacts } from "@/domain/eval/breakthrough-031/write-artifacts";

async function main() {
  const report = loadTask031ReportForUi() ?? (await runTask031({ skipHeavy: false }));
  if (!loadTask031ReportForUi()) writeTask031Artifacts(report);
  console.log(renderAnnualBankroll031(report));
  const bets = report.annual.reduce((a, r) => a + r.bets, 0);
  if (!report.capital_test && bets !== 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
