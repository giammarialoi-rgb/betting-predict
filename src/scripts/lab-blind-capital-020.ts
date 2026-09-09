import { runTask020 } from "@/domain/eval/capital-020/lab";
import { writeTask020Artifacts } from "@/domain/eval/capital-020/write-artifacts";
import { auditTask020 } from "@/domain/eval/capital-020/audit";

async function main() {
  const report = await runTask020({ allowNetwork: true });
  writeTask020Artifacts(report);
  const audit = auditTask020(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        winner: report.winner,
        dataset: report.dataset,
        counts: report.counts,
        frozen_model: report.frozen_model,
        better_than_date_only: report.better_than_date_only,
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
