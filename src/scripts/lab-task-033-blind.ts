import { loadTask033ReportForUi, runTask033 } from "@/domain/eval/market-033/lab";
import { renderBlindProtocol033, writeTask033Artifacts } from "@/domain/eval/market-033/write-artifacts";

async function main() {
  const report = loadTask033ReportForUi() ?? (await runTask033({ skipHeavy: false }));
  if (!loadTask033ReportForUi()) writeTask033Artifacts(report);
  console.log(renderBlindProtocol033(report));
  if (report.leakage.some((l) => !l.throws)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
