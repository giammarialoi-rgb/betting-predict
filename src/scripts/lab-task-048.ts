import { config } from "dotenv";
import { runTask048, printVerdictBlock048 } from "@/domain/eval/factory-048/lab";
import { auditTask048 } from "@/domain/eval/factory-048/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const report = await runTask048({ discover });
  console.log(printVerdictBlock048(report));
  const audit = auditTask048(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
