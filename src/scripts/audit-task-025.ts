import { auditTask025 } from "@/domain/eval/turnaround-025/audit";
import { loadTask025ReportForUi, runTask025 } from "@/domain/eval/turnaround-025/lab";

async function main() {
  const report = loadTask025ReportForUi() ?? (await runTask025({ allowNetwork: false, skipResearchCorpus: true }));
  const audit = auditTask025(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
