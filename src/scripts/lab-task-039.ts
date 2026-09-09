import { config } from "dotenv";
import { auditTask039 } from "@/domain/eval/live-039/audit";
import { fingerprint039, printVerdictBlock039, runTask039 } from "@/domain/eval/live-039/lab";
import { getOddsApiKey } from "@/domain/eval/live-039/sources";
import { writeTask039Artifacts } from "@/domain/eval/live-039/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const live = Boolean(getOddsApiKey());
  const first = await runTask039({ livePull: live });
  writeTask039Artifacts(first);
  const second = await runTask039({ livePull: false });
  const fp2 = fingerprint039({
    verdict: second.FINAL_VERDICT,
    exp: second.experiment_sha256,
    live: second.dataset_fingerprint,
    strict: second.STRICT_EVENTS,
    bets: 0,
    winner: null,
    configured: second.API_KEY_CONFIGURED,
  });
  const reproducible = first.fingerprint === fp2 && first.FINAL_VERDICT === second.FINAL_VERDICT;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask039Artifacts(first);
  const audit = auditTask039(first);
  console.log(printVerdictBlock039(first));
  console.log(JSON.stringify({ fingerprint: first.fingerprint, audit, reproducibility: first.reproducibility }, null, 2));
  if (!audit.ok || !reproducible) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
