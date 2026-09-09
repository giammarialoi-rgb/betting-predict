import { loadTask035ReportForUi, runTask035 } from "@/domain/eval/breakthrough-035/lab";
import { renderAnnual035, writeTask035Artifacts } from "@/domain/eval/breakthrough-035/write-artifacts";

async function main() {
  const report = loadTask035ReportForUi() ?? (await runTask035({ skipHeavy: false }));
  if (!loadTask035ReportForUi()) writeTask035Artifacts(report);
  console.log(renderAnnual035(report));
  if (report.annual.some((r) => r.bets === 0 && r.end === 1000)) process.exit(1);
  if (report.CAPITAL_QUALIFIED || report.BETS !== 0) process.exit(1);
  if (report.BANKROLL !== "—") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
