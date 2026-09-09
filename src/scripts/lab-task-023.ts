import { auditTask023 } from "@/domain/eval/temporal-023/audit";
import { runTask023 } from "@/domain/eval/temporal-023/lab";
import { writeTask023Artifacts } from "@/domain/eval/temporal-023/write-artifacts";

async function main() {
  const report = await runTask023({ allowNetwork: true });
  writeTask023Artifacts(report);
  const audit = auditTask023(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        winner: report.winner,
        strict_events: report.scientific.strict_events,
        official_strict_events: report.scientific.official_strict_events,
        timestamp_observations: report.scientific.timestamp_observations,
        coverage: report.coverage,
        first_available: report.first_available,
        clv: report.blind.clv,
        decision: report.blind.decision,
        leakage: report.leakage,
        annual: report.annual,
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
