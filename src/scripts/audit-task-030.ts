import { auditTask030, loadTask030ReportForUi, runTask030 } from "@/domain/eval/final-edge-lab";

async function main() {
  const report = loadTask030ReportForUi() ?? (await runTask030({ skipHeavy: true }));
  const audit = auditTask030(report);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
