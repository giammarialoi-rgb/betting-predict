import { acquireTask031 } from "@/domain/eval/breakthrough-031/acquire";
import { auditTask031 } from "@/domain/eval/breakthrough-031/audit";
import { fingerprint031, runTask031 } from "@/domain/eval/breakthrough-031/lab";
import { writeTask031Artifacts } from "@/domain/eval/breakthrough-031/write-artifacts";

async function main() {
  const acq = await acquireTask031({ skipHeavy: false });
  const first = await runTask031({ skipHeavy: false });
  writeTask031Artifacts(first);
  const second = await runTask031({ skipHeavy: false });
  const audit = auditTask031(first);
  const reproducible =
    first.fingerprint ===
    fingerprint031({
      verdict: second.verdict,
      baseSha: second.observed_base_sha256,
      unionSha: second.union_fingerprint,
      strict: second.strict_events,
      added: second.added_strict_events,
      predictiveGate: second.predictive_gate,
    });
  console.log(
    JSON.stringify(
      {
        TEST: "see pnpm test",
        AUDIT: audit.ok ? "PASS" : "FAIL",
        REPRODUCIBILITY: reproducible ? "PASS" : "FAIL",
        STRICT_EVENTS: first.strict_events,
        MODEL_READY: first.model_ready,
        CAPITAL_TEST: first.capital_test,
        WINNER: first.winner,
        REAL_MONEY: first.real_money,
        AUTO_PROMOTION: first.auto_promotion,
        FINAL_VERDICT: first.verdict,
        added_strict: first.added_strict_events,
        hunt_exhausted: acq.hunt_exhausted,
        holdout_2020_plus: first.holdout_2020_plus,
        fingerprint: first.fingerprint,
        audit_failures: audit.failures,
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
