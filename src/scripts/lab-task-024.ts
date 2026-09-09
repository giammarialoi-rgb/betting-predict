import { auditTask024 } from "@/domain/eval/attack-024/audit";
import { runTask024 } from "@/domain/eval/attack-024/lab";
import { writeTask024Artifacts } from "@/domain/eval/attack-024/write-artifacts";

async function main() {
  const report = await runTask024({ allowNetwork: true });
  writeTask024Artifacts(report);
  const audit = auditTask024(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        success: report.success,
        winner: report.winner,
        metrics: report.metrics,
        strict_ledger: report.strict_ledger,
        rejects: report.rejects,
        next_blockers: report.next_blockers.map((b) => ({
          rank: b.rank,
          id: b.id,
          eig: b.expected_information_gain,
        })),
        leakage: report.leakage,
        soccer_files: report.soccer_files,
        btb_series_case: report.btb_series_case,
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
