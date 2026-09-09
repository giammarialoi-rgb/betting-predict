import { config } from "dotenv";
import { runTask057, printVerdict057 } from "@/domain/data-sources/api-sports/lab";
import { auditTask057 } from "@/domain/data-sources/api-sports/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask057();
  console.log(printVerdict057(report));
  const audit = auditTask057(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
