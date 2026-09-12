import { runPhase9Backtest } from "@/domain/eval/phase-9/run";

async function main() {
  const result = await runPhase9Backtest({});
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
