import { auditTask026 } from "@/domain/eval/bottleneck-026/audit";
import { onePageVerdict, runTask026 } from "@/domain/eval/bottleneck-026/lab";
import { writeTask026Artifacts } from "@/domain/eval/bottleneck-026/write-artifacts";

async function main() {
  const report = await runTask026({ allowNetwork: true, skipHeavy: false });
  writeTask026Artifacts(report);
  const audit = auditTask026(report);
  console.log(onePageVerdict(report));
  console.log(JSON.stringify({ audit, funnel: report.funnel, success_band: report.success_band }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
