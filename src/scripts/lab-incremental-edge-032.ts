import { loadTask032ReportForUi, runTask032 } from "@/domain/eval/incremental-032/lab";
import { renderFinalReport032, writeTask032Artifacts } from "@/domain/eval/incremental-032/write-artifacts";

async function main() {
  const report = loadTask032ReportForUi() ?? (await runTask032({ skipHeavy: false }));
  if (!loadTask032ReportForUi()) writeTask032Artifacts(report);
  const start = renderFinalReport032(report).indexOf("| Modello |");
  const end = renderFinalReport032(report).indexOf("## Stress");
  const md = renderFinalReport032(report);
  console.log(md.slice(start, end));
  console.log(`VERDICT ${report.verdict}`);
  console.log(`SELECTED ${report.selected_on_val}`);
  console.log(`QUALIFIED ${report.qualified}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
