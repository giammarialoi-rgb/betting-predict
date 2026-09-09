import { runPredictiveIntelligenceLab } from "@/domain/eval/predictive-intelligence/lab";

async function main() {
  const result = await runPredictiveIntelligenceLab({ evaluateHoldout: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
