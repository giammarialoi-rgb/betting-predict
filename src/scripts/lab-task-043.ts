import { config } from "dotenv";
import { auditTask043 } from "@/domain/eval/live-043/audit";
import { fingerprint043, printVerdictBlock043, runTask043 } from "@/domain/eval/live-043/lab";
import { writeTask043Artifacts } from "@/domain/eval/live-043/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

function stable(r: Awaited<ReturnType<typeof runTask043>>): string {
  return fingerprint043({
    verdict: r.FINAL_VERDICT,
    exp: r.experiment_sha256,
    catalog: r.TOTAL_EVENTS,
    locked: r.LOCKED_DECISIONS,
    settled: r.SETTLED_EVENTS,
    model: r.MODEL_VERSION,
    bets: 0,
  });
}

async function main() {
  const first = await runTask043({ runCollector042: false });
  const second = await runTask043({ runCollector042: false });
  const ok = stable(first) === stable(second);
  first.reproducibility = ok ? "PASS" : "FAIL";
  first.fingerprint = stable(first);
  writeTask043Artifacts(first);
  const audit = auditTask043(first);
  console.log(printVerdictBlock043(first));
  console.log(JSON.stringify({ fingerprint: first.fingerprint, audit, reproducibility: first.reproducibility }, null, 2));
  if (!audit.ok || !ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
