import { persistHarvestManifests, printVerdictBlock037, runTask037, fingerprint037 } from "@/domain/eval/harvest-037/lab";
import { writeTask037Artifacts } from "@/domain/eval/harvest-037/write-artifacts";
import { auditTask037 } from "@/domain/eval/harvest-037/audit";
import { SINGLE_MISSING_RESOURCE_037 } from "@/domain/eval/harvest-037/lake";
import { experimentSha037 } from "@/domain/eval/harvest-037/config";

async function main() {
  const skip = process.env.TASK_037_SKIP_HEAVY === "1";
  const first = await runTask037({ skipHeavy: skip });
  persistHarvestManifests(first.harvest);
  writeTask037Artifacts(first);
  const second = await runTask037({ skipHeavy: skip });
  const fp2 = fingerprint037({
    verdict: "FINAL_BLOCKER",
    exp: experimentSha037(),
    strict: 0,
    bets: 0,
    winner: null,
    scanned: second.GITHUB_REPOSITORIES_SCANNED,
    missing: SINGLE_MISSING_RESOURCE_037,
  });
  const reproducible = first.fingerprint === fp2 && first.VERDICT === second.VERDICT;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask037Artifacts(first);
  const audit = auditTask037(first);
  console.log(printVerdictBlock037(first));
  console.log(JSON.stringify({ fingerprint: first.fingerprint, audit, missing_resource: first.missing_resource }, null, 2));
  if (!audit.ok || !reproducible) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
