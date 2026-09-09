import { config } from "dotenv";
import { auditTask038 } from "@/domain/eval/datalake-038/audit";
import { getOddsApiKey } from "@/domain/eval/datalake-038/sources";
import { fingerprint038, printVerdictBlock038, runTask038 } from "@/domain/eval/datalake-038/lab";
import { writeTask038Artifacts } from "@/domain/eval/datalake-038/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const live = Boolean(getOddsApiKey());
  const first = await runTask038({ livePull: live, persistLake: true });
  writeTask038Artifacts(first);
  const second = await runTask038({ livePull: false, persistLake: true });
  const fp2 = fingerprint038({
    verdict: second.FINAL_VERDICT,
    exp: second.experiment_sha256,
    lake: second.lake.fingerprint,
    live: second.dataset_fingerprint,
    strictEvents: second.STRICT_EVENTS,
    bets: 0,
    winner: null,
    apiKey: second.API_KEY,
  });
  const reproducible = first.fingerprint === fp2 && first.FINAL_VERDICT === second.FINAL_VERDICT;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask038Artifacts(first);
  const audit = auditTask038(first);
  console.log(printVerdictBlock038(first));
  console.log(
    JSON.stringify(
      {
        fingerprint: first.fingerprint,
        audit,
        reproducibility: first.reproducibility,
        DATA_PROBLEM: first.DATA_PROBLEM,
        MODEL_PROBLEM: first.MODEL_PROBLEM,
        CAPITAL_PROBLEM: first.CAPITAL_PROBLEM,
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
