import { config } from "dotenv";
import { runTask054Supervisor, printSupervisorVerdict054 } from "@/domain/eval/supervisor-054/lab";
import { auditTask054Supervisor } from "@/domain/eval/supervisor-054/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask054Supervisor();
  console.log(printSupervisorVerdict054(report));
  const audit = auditTask054Supervisor(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
