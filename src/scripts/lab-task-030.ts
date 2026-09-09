import { auditTask030, fingerprint030, runTask030 } from "@/domain/eval/final-edge-lab";
import { writeTask030Artifacts } from "@/domain/eval/final-edge-report";

async function main() {
  const first = await runTask030({ skipHeavy: false });
  writeTask030Artifacts(first);
  const second = await runTask030({ skipHeavy: false });
  const fp1 = first.fingerprint;
  const fp2 = fingerprint030({
    verdict: second.verdict,
    scores: Object.fromEntries(
      Object.entries(second.scores).map(([k, v]) => [k, { TEST: v.TEST, HOLDOUT: v.HOLDOUT }]),
    ),
    selected: second.selected_families,
  });
  const audit = auditTask030(first);
  const reproducible = fp1 === fp2 && first.verdict === second.verdict && first.observed_sha256 === second.observed_sha256;
  console.log(
    JSON.stringify(
      {
        verdict: first.verdict,
        production: first.production,
        sha: first.observed_sha256,
        test: first.partitions.TEST.events,
        holdout: first.partitions.HOLDOUT.events,
        movement_rows: first.movement_rows,
        selected: first.selected_families,
        feature_status: first.feature_status,
        market_brier: first.scores.market_only?.TEST.brier,
        all_brier: first.scores.market_all?.TEST.brier,
        all_delta: first.scores.market_all?.TEST.delta_brier,
        predictive_gate: first.predictive_gate,
        winner: first.winner,
        fingerprint: fp1,
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
