import { config } from "dotenv";
import { auditTask043 } from "@/domain/eval/live-043/audit";
import { runTask043 } from "@/domain/eval/live-043/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask043({ runCollector042: false });
  const audit = auditTask043(report);
  console.log(JSON.stringify({ ok: audit.ok, failures: audit.failures, verdict: report.FINAL_VERDICT, BETS: report.BETS, BANKROLL: report.BANKROLL }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
