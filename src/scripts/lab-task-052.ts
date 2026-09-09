import { config } from "dotenv";
import { runTask052, printVerdictBlock052 } from "@/domain/eval/ui-052/lab";
import { auditTask052 } from "@/domain/eval/ui-052/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask052();
  console.log(printVerdictBlock052(report));
  const audit = auditTask052(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok || report.UI_STATUS !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
