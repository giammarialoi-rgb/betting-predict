import { config } from "dotenv";
import { runTask051, printVerdictBlock051 } from "@/domain/eval/brain-051/lab";
import { auditTask051 } from "@/domain/eval/brain-051/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask051();
  console.log(printVerdictBlock051(report));
  const audit = auditTask051(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
