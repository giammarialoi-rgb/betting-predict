import { auditTask033 } from "@/domain/eval/market-033/audit";
import { fingerprint033, runTask033 } from "@/domain/eval/market-033/lab";
import { writeTask033Artifacts } from "@/domain/eval/market-033/write-artifacts";

async function main() {
  const skip = process.env.TASK_033_SKIP_HEAVY === "1";
  const first = await runTask033({ skipHeavy: skip });
  writeTask033Artifacts(first);
  const second = await runTask033({ skipHeavy: skip });
  const fp2 = fingerprint033({
    verdict: second.verdict,
    carryFp: second.carry_032_fingerprint,
    sha031: second.observed_031_sha256,
    basic: second.basic,
    weekly: second.weekly.families,
    markets: second.markets.map((m) => ({ market: m.market, verdict: m.verdict, strict_events: m.strict_events })),
  });
  const audit = auditTask033(first);
  const reproducible =
    first.fingerprint === fp2 &&
    first.verdict === second.verdict &&
    first.observed_031_sha256 === second.observed_031_sha256 &&
    first.carry_032_fingerprint === second.carry_032_fingerprint;
  first.reproducibility = reproducible ? "PASS" : "FAIL";
  writeTask033Artifacts(first);
  console.log(
    JSON.stringify(
      {
        TASK_033_VERDICT: first.verdict,
        DATASET: first.dataset_id,
        STRICT_EVENTS: first.strict_events_1x2,
        STRICT_MARKETS: first.strict_markets,
        MODEL_READY: first.model_ready_markets,
        BEST_MARKET: first.best_market,
        BEST_MODEL: first.best_model,
        DELTA_VS_MARKET: first.delta_vs_market,
        HOLM: first.holm.n_tests,
        HOLDOUT: first.HOLDOUT_STATUS,
        BET_COUNT: first.BET_COUNT,
        BANKROLL: first.BANKROLL,
        WINNER: first.winner,
        AUTO_PROMOTION: first.auto_promotion,
        REAL_MONEY: first.real_money,
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
