import { loadPhase9Registry } from "@/domain/eval/phase-9/registry";
import { PHASE9_PROMOTION_POLICY, CURRENT_PRODUCTION_MODEL_ID } from "@/domain/eval/phase-9/config";

function main() {
  const reg = loadPhase9Registry();
  console.log(
    JSON.stringify(
      {
        neon_in_use: false,
        current_production: CURRENT_PRODUCTION_MODEL_ID,
        policy: PHASE9_PROMOTION_POLICY,
        registry: reg,
      },
      null,
      2,
    ),
  );
}

main();
