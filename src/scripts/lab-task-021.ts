import { runTask021 } from "@/domain/eval/capital-021/lab";
import { writeTask021Artifacts } from "@/domain/eval/capital-021/write-artifacts";
import { auditTask021 } from "@/domain/eval/capital-021/audit";

async function main() {
  const report = await runTask021({ allowNetwork: true });
  writeTask021Artifacts(report);
  const audit = auditTask021(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        winner: report.winner,
        ledger: report.ledger,
        format_fixtures: report.format_fixtures,
        counts: report.counts,
        scientific: report.scientific,
        probes: report.probes,
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
