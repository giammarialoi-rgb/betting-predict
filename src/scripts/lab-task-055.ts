import { config } from "dotenv";
import { runTask055, printVerdictBlock055 } from "@/domain/eval/catalog-055/lab";
import { auditTask055 } from "@/domain/eval/catalog-055/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask055();
  console.log(printVerdictBlock055(report));
  const audit = auditTask055(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
