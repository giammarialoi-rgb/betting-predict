import { runTask028 } from "@/domain/eval/validation-028/lab";

async function main() {
  const report = await runTask028({ skipHeavy: false });
  const rows = ["market_devig", "frequency", "elo", "form", "poisson", "logistic", "ensemble"].map((id) => ({
    id,
    test: report.scores[id]?.TEST ?? null,
    holdout: report.scores[id]?.HOLDOUT ?? null,
  }));
  console.log(JSON.stringify({ verdict: report.verdict, rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
