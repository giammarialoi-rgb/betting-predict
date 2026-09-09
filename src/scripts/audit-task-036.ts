import { config } from "dotenv";
import { auditTask036 } from "@/domain/eval/prospective-036/audit";
import { loadTask036ReportForUi, runTask036 } from "@/domain/eval/prospective-036/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = loadTask036ReportForUi() ?? (await runTask036({ livePull: false }));
  const audit = auditTask036(report);
  console.log(JSON.stringify({ ok: audit.ok, failures: audit.failures, verdict: report.verdict, BETS: report.BETS, BANKROLL: report.BANKROLL }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
