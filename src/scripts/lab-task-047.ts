import { config } from "dotenv";
import { runTask047, printVerdictBlock047 } from "@/domain/eval/factory-047/lab";
import { auditTask047 } from "@/domain/eval/factory-047/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const report = await runTask047({ discover });
  console.log(printVerdictBlock047(report));
  const audit = auditTask047(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
