import { loadTask033ReportForUi, runTask033 } from "@/domain/eval/market-033/lab";
import { renderMarketAudit033, writeTask033Artifacts } from "@/domain/eval/market-033/write-artifacts";

async function main() {
  const report = loadTask033ReportForUi() ?? (await runTask033({ skipHeavy: false }));
  if (!loadTask033ReportForUi()) writeTask033Artifacts(report);
  console.log(renderMarketAudit033(report));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
