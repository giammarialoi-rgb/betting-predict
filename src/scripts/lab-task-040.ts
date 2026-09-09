import { config } from "dotenv";
import { auditTask040 } from "@/domain/eval/recover-040/audit";
import { fingerprint040, printVerdictBlock040, runTask040 } from "@/domain/eval/recover-040/lab";
import { writeTask040Artifacts } from "@/domain/eval/recover-040/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const first = await runTask040({ recoverLocks: true, reveal: false });
  writeTask040Artifacts(first);
  const second = await runTask040({ recoverLocks: true, reveal: false });
  const fp2 = fingerprint040({
    verdict: second.FINAL_VERDICT,
    exp: second.experiment_sha256,
    quotes: second.UNIQUE_QUOTES,
    locked: second.LOCKED_DECISIONS,
    settled: second.SETTLED_EVENTS,
    bets: 0,
    winner: null,
  });
  const reproducible = first.fingerprint === fp2 && first.FINAL_VERDICT === second.FINAL_VERDICT;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask040Artifacts(first);
  const audit = auditTask040(first);
  console.log(printVerdictBlock040(first));
  console.log(
    JSON.stringify(
      {
        fingerprint: first.fingerprint,
        audit,
        reproducibility: first.reproducibility,
        recover_table: first.recover_table,
      },
      null,
      2,
    ),
  );
  if (!audit.ok || !reproducible) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
