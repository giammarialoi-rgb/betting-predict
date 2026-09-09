import { loadTask034ReportForUi, runTask034 } from "@/domain/eval/market-034/lab";
import { renderBlind034, writeTask034Artifacts } from "@/domain/eval/market-034/write-artifacts";

async function main() {
  const report = loadTask034ReportForUi() ?? (await runTask034({ skipHeavy: false }));
  if (!loadTask034ReportForUi()) writeTask034Artifacts(report);
  console.log(renderBlind034(report));
  if (report.leakage.some((l) => !l.throws)) process.exit(1);
  if (report.test_used_for_selection || report.HOLDOUT_TOUCHED) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
