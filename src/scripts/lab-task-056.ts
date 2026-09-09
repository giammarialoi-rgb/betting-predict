import { config } from "dotenv";
import { runTask056, printVerdictBlock056 } from "@/domain/eval/audit-056/lab";
import { auditTask056 } from "@/domain/eval/audit-056/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask056();
  console.log(printVerdictBlock056(report));
  const audit = auditTask056(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
