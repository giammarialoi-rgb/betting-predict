import { runPhase9Backtest } from "@/domain/eval/phase-9/run";
import { readPhase9Json } from "@/domain/eval/phase-9/persist";

async function main() {
  const existing = readPhase9Json<Record<string, unknown>>("model-comparison.json");
  if (existing && process.argv.includes("--cached")) {
    console.log(JSON.stringify(existing, null, 2));
    return;
  }
  await runPhase9Backtest({});
  const cmp = readPhase9Json("model-comparison.json");
  console.log(JSON.stringify(cmp, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
