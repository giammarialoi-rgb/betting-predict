import { loadTask034ReportForUi, runTask034 } from "@/domain/eval/market-034/lab";
import { renderAnnual034, writeTask034Artifacts } from "@/domain/eval/market-034/write-artifacts";

async function main() {
  const report = loadTask034ReportForUi() ?? (await runTask034({ skipHeavy: false }));
  if (!loadTask034ReportForUi()) writeTask034Artifacts(report);
  console.log(renderAnnual034(report));
  if (report.annual.some((r) => r.bets === 0 && r.end === 1000)) process.exit(1);
  if (report.CAPITAL_QUALIFIED || report.BET_COUNT !== 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
