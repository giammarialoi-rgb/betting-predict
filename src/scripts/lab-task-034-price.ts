import { loadTask034ReportForUi, runTask034 } from "@/domain/eval/market-034/lab";
import { renderPriceDiscovery034, writeTask034Artifacts } from "@/domain/eval/market-034/write-artifacts";

async function main() {
  const report = loadTask034ReportForUi() ?? (await runTask034({ skipHeavy: false }));
  if (!loadTask034ReportForUi()) writeTask034Artifacts(report);
  console.log(renderPriceDiscovery034(report));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
