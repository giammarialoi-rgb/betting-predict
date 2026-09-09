import { config } from "dotenv";
import { runLive043Cycle } from "@/domain/eval/live-043/cycle";
import { remainingCredits042, loadCreditState042 } from "@/domain/eval/collector-042/credit";
import { sourceStore043 } from "@/domain/eval/live-043/config";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const result = await runLive043Cycle({ runCollector042: false });
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        credits: {
          remaining: remainingCredits042(loadCreditState042(sourceStore043())),
          note: "once default: no odds discovery (0 API spend unless runCollector042)",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
