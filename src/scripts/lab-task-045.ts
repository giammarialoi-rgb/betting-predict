import { config } from "dotenv";
import { runTask045, printVerdictBlock045 } from "@/domain/eval/factory-045/lab";
import { auditTask045 } from "@/domain/eval/factory-045/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const report = await runTask045({ discover, settle: false });
  console.log(printVerdictBlock045(report));
  const audit = auditTask045(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
