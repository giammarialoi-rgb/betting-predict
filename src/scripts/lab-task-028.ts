import { auditTask028 } from "@/domain/eval/validation-028/audit";
import { runTask028 } from "@/domain/eval/validation-028/lab";
import { writeTask028Artifacts } from "@/domain/eval/validation-028/write-artifacts";

async function main() {
  const report = await runTask028({ skipHeavy: false });
  writeTask028Artifacts(report);
  const audit = auditTask028(report);
  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        sha256: report.freeze.sha256,
        events: report.freeze.events,
        partitions: report.partitions,
        market_brier_test: report.metrics.market_brier_test,
        model_brier_test: report.metrics.model_brier_test,
        test_roi: report.metrics.test_roi,
        holdout_roi: report.metrics.holdout_roi,
        winner: report.winner,
        promotion: report.promotion.promotion,
        audit,
      },
      null,
      2,
    ),
  );
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
