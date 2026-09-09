import { auditTask029 } from "@/domain/eval/incremental-029/audit";
import { runTask029 } from "@/domain/eval/incremental-029/lab";
import { writeTask029Artifacts } from "@/domain/eval/incremental-029/write-artifacts";

async function main() {
  const report = await runTask029({ skipHeavy: false });
  writeTask029Artifacts(report);
  const audit = auditTask029(report);
  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        sha: report.observed_sha256,
        test: report.partitions.TEST.events,
        holdout: report.partitions.HOLDOUT.events,
        overlay_rows: report.overlay_rows,
        selected: report.selected_families,
        market_brier: report.scores.market_only?.TEST.brier,
        m7_brier: report.scores.market_all_safe?.TEST.brier,
        m7_delta: report.scores.market_all_safe?.TEST.delta_brier,
        predictive_gate: report.predictive_gate,
        promotion: report.promotion,
        winner: report.winner,
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
