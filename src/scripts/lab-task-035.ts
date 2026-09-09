import { auditTask035 } from "@/domain/eval/breakthrough-035/audit";
import { fingerprint035, printVerdictBlock035, runTask035 } from "@/domain/eval/breakthrough-035/lab";
import { writeTask035Artifacts } from "@/domain/eval/breakthrough-035/write-artifacts";

async function main() {
  const skip = process.env.TASK_035_SKIP_HEAVY === "1";
  const first = await runTask035({ skipHeavy: skip });
  writeTask035Artifacts(first);
  const second = await runTask035({ skipHeavy: skip });
  const fp2 = fingerprint035({
    verdict: second.verdict,
    newStrict: second.strict_events,
    newStrict2020: second.strict_2020_plus,
    legacy: second.observed_sha256,
    exp: second.experiment_sha256,
    investigated: second.sources_investigated,
    usable: second.sources_usable,
    test: second.TEST_EVENTS,
    holdout: second.HOLDOUT_EVENTS,
    bets: second.BETS,
    winner: second.winner,
    match_exact: second.match_exact,
  });
  const reproducible = first.fingerprint === fp2 && first.verdict === second.verdict;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask035Artifacts(first);
  const audit = auditTask035(first);
  console.log(printVerdictBlock035(first));
  console.log(
    JSON.stringify(
      {
        fingerprint: first.fingerprint,
        audit,
        reproducibility: first.reproducibility,
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
