import { config } from "dotenv";
import { runTask046, printVerdictBlock046 } from "@/domain/eval/control-046/lab";
import { auditTask046 } from "@/domain/eval/control-046/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask046();
  console.log(printVerdictBlock046(report));
  const audit = auditTask046(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
