import { config } from "dotenv";
import { auditTask040 } from "@/domain/eval/recover-040/audit";
import { runTask040 } from "@/domain/eval/recover-040/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask040({ recoverLocks: true, reveal: false });
  const audit = auditTask040(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.FINAL_VERDICT,
        API_KEY_CONFIGURED: report.API_KEY_CONFIGURED,
        QUOTE_OBSERVATIONS: report.QUOTE_OBSERVATIONS,
        EVENTS_DISCOVERED: report.EVENTS_DISCOVERED,
        LOCKED_DECISIONS: report.LOCKED_DECISIONS,
        SETTLED_EVENTS: report.SETTLED_EVENTS,
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
