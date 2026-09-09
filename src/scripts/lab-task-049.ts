import { config } from "dotenv";
import { runTask049, printVerdictBlock049 } from "@/domain/eval/factory-049/lab";
import { auditTask049 } from "@/domain/eval/factory-049/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const report = await runTask049({ discover });
  console.log(printVerdictBlock049(report));
  const audit = auditTask049(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
