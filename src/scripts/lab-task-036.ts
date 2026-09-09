import { config } from "dotenv";
import { auditTask036 } from "@/domain/eval/prospective-036/audit";
import { fingerprint036, printVerdictBlock036, runTask036 } from "@/domain/eval/prospective-036/lab";
import { getFootballDataOrgToken, getOddsApiKey } from "@/domain/eval/prospective-036/sources";
import { writeTask036Artifacts } from "@/domain/eval/prospective-036/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const live = process.env.TASK_036_LIVE_PULL === "1" || Boolean(getOddsApiKey());
  const first = await runTask036({ livePull: live });
  writeTask036Artifacts(first);
  const second = await runTask036({ livePull: false });
  const fp2 = fingerprint036({
    verdict: second.verdict,
    exp: second.experiment_sha256,
    dataset: second.dataset_fingerprint,
    strictEvents: second.STRICT_EVENTS,
    bets: 0,
    winner: null,
    oddsKey: Boolean(getOddsApiKey()),
    fdTok: Boolean(getFootballDataOrgToken()),
  });
  const reproducible = first.fingerprint === fp2 && first.verdict === second.verdict;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask036Artifacts(first);
  const audit = auditTask036(first);
  console.log(printVerdictBlock036(first));
  console.log(JSON.stringify({ fingerprint: first.fingerprint, audit, reproducibility: first.reproducibility, blocker: first.blocker }, null, 2));
  if (!audit.ok || !reproducible) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
