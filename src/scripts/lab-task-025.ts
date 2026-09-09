import { auditTask025 } from "@/domain/eval/turnaround-025/audit";
import { runTask025 } from "@/domain/eval/turnaround-025/lab";
import { writeTask025Artifacts } from "@/domain/eval/turnaround-025/write-artifacts";

async function main() {
  const report = await runTask025({ allowNetwork: true });
  writeTask025Artifacts(report);
  const audit = auditTask025(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        winner: report.winner,
        metrics: report.metrics,
        answers: report.answers,
        overlay: report.overlay,
        research: report.research,
        leakage: report.leakage,
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
