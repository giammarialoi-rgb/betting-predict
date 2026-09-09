import { auditTask027 } from "@/domain/eval/breakthrough-027/audit";
import { onePageVerdict, runTask027 } from "@/domain/eval/breakthrough-027/lab";
import { writeTask027Artifacts } from "@/domain/eval/breakthrough-027/write-artifacts";
import { extractStrictIfNeeded } from "@/domain/eval/breakthrough-027/acquire";

async function main() {
  extractStrictIfNeeded();
  const report = await runTask027({ allowNetwork: true, skipHeavy: false });
  writeTask027Artifacts(report);
  const audit = auditTask027(report);
  console.log(onePageVerdict(report));
  console.log(
    JSON.stringify(
      {
        audit,
        data_band: report.data_band,
        scientific_verdict: report.scientific_verdict,
        strict: report.metrics.strict_events,
        bets: report.metrics.bets,
        years_testable: report.metrics.years_testable,
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
