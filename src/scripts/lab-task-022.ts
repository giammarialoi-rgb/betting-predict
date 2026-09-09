import { runTask022 } from "@/domain/eval/recovery-022/lab";
import { writeTask022Artifacts } from "@/domain/eval/recovery-022/write-artifacts";
import { auditTask022 } from "@/domain/eval/recovery-022/audit";

async function main() {
  const report = await runTask022({ allowNetwork: true, skipFullInspect: false });
  writeTask022Artifacts(report);
  const audit = auditTask022(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        winner: report.winner,
        closing: report.closing,
        series: report.series,
        matching: report.matching,
        diagnostic: {
          has_time_series: report.diagnostic.has_time_series,
          granularity: report.diagnostic.granularity,
          timestamp_absolute: report.diagnostic.timestamp_absolute,
          relative_to_kickoff_exact: report.diagnostic.relative_to_kickoff_exact,
          can_reconstruct_asof: report.diagnostic.can_reconstruct_asof,
          horizons: report.diagnostic.horizons,
        },
        counts: report.counts,
        scientific: report.scientific,
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
