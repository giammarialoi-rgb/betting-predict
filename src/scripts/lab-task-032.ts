import { auditTask032 } from "@/domain/eval/incremental-032/audit";
import { fingerprint032, runTask032 } from "@/domain/eval/incremental-032/lab";
import { writeTask032Artifacts } from "@/domain/eval/incremental-032/write-artifacts";

async function main() {
  const first = await runTask032({ skipHeavy: false });
  writeTask032Artifacts(first);
  const second = await runTask032({ skipHeavy: false });
  const fp2 = fingerprint032({
    verdict: second.verdict,
    featureFp: second.feature_fingerprint,
    datasetSha: second.observed_sha256,
    selected: second.selected_on_val,
    testScores: Object.fromEntries(Object.entries(second.scores).map(([k, v]) => [k, v.TEST])),
    predictionsFp: second.predictions_fingerprint,
  });
  const audit = auditTask032(first);
  const reproducible =
    first.fingerprint === fp2 &&
    first.feature_fingerprint === second.feature_fingerprint &&
    first.predictions_fingerprint === second.predictions_fingerprint &&
    first.verdict === second.verdict &&
    first.observed_sha256 === second.observed_sha256;
  console.log(
    JSON.stringify(
      {
        TASK_032_VERDICT: first.verdict,
        DATASET: first.dataset_version,
        STRICT_EVENTS: first.strict_events,
        BASELINE: first.baseline,
        BEST_INCREMENTAL_MODEL: first.selected_on_val,
        DELTA_BRIER: first.scores[first.selected_on_val ?? "market_all"]?.TEST.delta_brier ?? first.scores.market_all?.TEST.delta_brier,
        DELTA_LOGLOSS: first.scores[first.selected_on_val ?? "market_all"]?.TEST.delta_logloss ?? first.scores.market_all?.TEST.delta_logloss,
        CI: first.stress?.ci95_delta_brier ?? first.ci95.market_all,
        HOLM: first.holm.rejected.some(Boolean),
        HOLDOUT: first.HOLDOUT_STATUS,
        BET_COUNT: first.annual.reduce((a, r) => a + r.bets, 0),
        BANKROLL_STATUS: first.qualified ? "QUALIFIED" : "NOT_QUALIFIED",
        WINNER: first.winner,
        REAL_MONEY: first.real_money,
        AUTO_PROMOTION: first.auto_promotion,
        REPRODUCIBILITY: reproducible ? "PASS" : "FAIL",
        LEAKAGE: audit.ok && first.leakage.every((l) => l.throws) ? "PASS" : "FAIL",
        FINAL_VERDICT: first.verdict,
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
