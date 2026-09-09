import { loadTask033ReportForUi, runTask033 } from "@/domain/eval/market-033/lab";
import { renderAnnual033, writeTask033Artifacts } from "@/domain/eval/market-033/write-artifacts";

async function main() {
  const report = loadTask033ReportForUi() ?? (await runTask033({ skipHeavy: false }));
  if (!loadTask033ReportForUi()) writeTask033Artifacts(report);
  console.log(renderAnnual033(report));
  if (report.annual.some((r) => r.bets === 0 && r.end === 1000)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
