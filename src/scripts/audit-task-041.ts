import { config } from "dotenv";
import { auditTask041 } from "@/domain/eval/close-041/audit";
import { runTask041 } from "@/domain/eval/close-041/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask041({ livePull: false, reveal: false, recoverLocks: true });
  const audit = auditTask041(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.FINAL_VERDICT,
        SETTLED_EVENTS: report.SETTLED_EVENTS,
        MISSING_TO_100: report.MISSING_TO_100,
        LOCKED_DECISIONS: report.LOCKED_DECISIONS,
        API_KEY_CONFIGURED: report.API_KEY_CONFIGURED,
        BETS: report.BETS,
        BANKROLL: report.BANKROLL,
      },
      null,
      2,
    ),
  );
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
