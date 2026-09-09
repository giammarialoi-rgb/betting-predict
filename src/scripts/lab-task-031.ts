import { auditTask031 } from "@/domain/eval/breakthrough-031/audit";
import { fingerprint031, runTask031 } from "@/domain/eval/breakthrough-031/lab";
import { writeTask031Artifacts } from "@/domain/eval/breakthrough-031/write-artifacts";

async function main() {
  const first = await runTask031({ skipHeavy: false });
  writeTask031Artifacts(first);
  const second = await runTask031({ skipHeavy: false });
  const fp2 = fingerprint031({
    verdict: second.verdict,
    baseSha: second.observed_base_sha256,
    unionSha: second.union_fingerprint,
    strict: second.strict_events,
    added: second.added_strict_events,
    predictiveGate: second.predictive_gate,
  });
  const audit = auditTask031(first);
  const reproducible =
    first.fingerprint === fp2 &&
    first.verdict === second.verdict &&
    first.observed_base_sha256 === second.observed_base_sha256 &&
    first.strict_events === second.strict_events;
  console.log(
    JSON.stringify(
      {
        verdict: first.verdict,
        model_ready: first.model_ready,
        capital_test: first.capital_test,
        strict_events: first.strict_events,
        added_strict_events: first.added_strict_events,
        period: [first.period_start, first.period_end],
        holdout_2020_plus: first.holdout_2020_plus,
        predictive_gate: first.predictive_gate,
        winner: first.winner,
        real_money: first.real_money,
        auto_promotion: first.auto_promotion,
        fingerprint: first.fingerprint,
        reproducibility: reproducible,
        audit,
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
