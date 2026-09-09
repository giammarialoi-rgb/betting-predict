import { config } from "dotenv";
import { runTask053, printVerdictBlock053 } from "@/domain/eval/bankroll-053/lab";
import { auditTask053 } from "@/domain/eval/bankroll-053/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask053();
  console.log(printVerdictBlock053(report));
  const audit = auditTask053(report);
  console.log(JSON.stringify({ audit, fingerprint: report.fingerprint }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
