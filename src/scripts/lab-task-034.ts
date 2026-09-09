import { auditTask034 } from "@/domain/eval/market-034/audit";
import { fingerprint034, runTask034 } from "@/domain/eval/market-034/lab";
import { writeTask034Artifacts } from "@/domain/eval/market-034/write-artifacts";

async function main() {
  const skip = process.env.TASK_034_SKIP_HEAVY === "1";
  const first = await runTask034({ skipHeavy: skip });
  writeTask034Artifacts(first);
  const second = await runTask034({ skipHeavy: skip });
  const fp2 = fingerprint034({
    verdict: second.verdict,
    sha: second.observed_sha256,
    exp: second.experiment_sha256,
    hyp: second.hypothesis_registry_hash,
    selected: second.selected_on_val,
    test: Object.fromEntries(Object.entries(second.scores).map(([k, v]) => [k, v.TEST])),
    holm: second.holm.adjusted_p,
    clv_status: second.CLV_STATUS,
  });
  const reproducible = first.fingerprint === fp2 && first.verdict === second.verdict;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask034Artifacts(first);
  const audit = auditTask034(first);
  console.log(
    JSON.stringify(
      {
        TASK_034_VERDICT: first.verdict,
        STRICT_EVENTS: first.strict_events,
        MARKET_SNAPSHOTS: first.market_snapshots,
        HYPOTHESES: first.hypotheses,
        SIGNIFICANT_SIGNALS: first.significant_signals,
        BEST_SIGNAL: first.best_signal,
        TEST_RESULT: first.selected_on_val,
        HOLM: first.holm.rejected.filter(Boolean).length,
        HOLDOUT: first.HOLDOUT_STATUS,
        CLV: first.CLV_STATUS,
        COST_ROBUST: first.COST_ROBUST,
        CAPITAL_QUALIFIED: first.CAPITAL_QUALIFIED,
        WINNER: first.winner,
        AUTO_PROMOTION: first.auto_promotion,
        REAL_MONEY: first.real_money,
        MARKET_EFFICIENCY: first.market_efficiency,
        REPRODUCIBILITY: first.reproducibility,
        LEAKAGE: audit.ok && first.leakage.every((l) => l.throws) ? "PASS" : "FAIL",
        fingerprint: first.fingerprint,
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
