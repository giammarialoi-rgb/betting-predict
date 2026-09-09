import { config } from "dotenv";
import { auditTask041 } from "@/domain/eval/close-041/audit";
import { printVerdictBlock041, runTask041 } from "@/domain/eval/close-041/lab";
import { writeTask041Artifacts } from "@/domain/eval/close-041/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const first = await runTask041({ livePull: true, reveal: true, recoverLocks: true });
  writeTask041Artifacts(first);
  const second = await runTask041({ livePull: false, reveal: false, recoverLocks: true });
  const third = await runTask041({ livePull: false, reveal: false, recoverLocks: true });
  const reproducible =
    second.fingerprint === third.fingerprint && second.FINAL_VERDICT === third.FINAL_VERDICT;
  third.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask041Artifacts(third);
  const audit = auditTask041(third);
  console.log(printVerdictBlock041(third));
  console.log(
    JSON.stringify(
      {
        fingerprint: third.fingerprint,
        audit,
        reproducibility: third.reproducibility,
        MISSING_TO_100: third.MISSING_TO_100,
        interpretation: third.interpretation,
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
