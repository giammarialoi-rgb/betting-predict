import { config } from "dotenv";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { loadStore043, loadModelRegistry043 } from "@/domain/eval/live-043/store";
import { artifactStore043, sourceStore043 } from "@/domain/eval/live-043/config";
import { loadStore039 } from "@/domain/eval/live-039/store";

config({ path: ".env.local" });
config({ path: ".env" });

const mode = process.argv[2] ?? "status";

function main() {
  if (mode === "logs") {
    console.log("See audit/external/task-039/collector.log and task-043 daily-reports/");
    return;
  }
  const src = sourceStore043();
  const art = artifactStore043();
  const coll = resolveDisplayedStatus042(src);
  const s039 = loadStore039(src);
  const s043 = loadStore043(art);
  const reg = loadModelRegistry043(art);
  const credit = loadCreditState042(src);
  console.log(
    JSON.stringify(
      {
        collector: coll,
        model_version: reg.current_version,
        catalog: s043.catalog.length,
        soccer: s043.catalog.filter((c) => c.sport === "soccer").length,
        tennis: s043.catalog.filter((c) => c.sport === "tennis").length,
        predictions: s043.predictions.length,
        snapshots: s043.snapshots.length,
        triangulations: s043.triangulations.length,
        autopsies: s043.autopsies.length,
        locked_039: s039.decisions.length,
        settled_039: s039.settlements.filter((x) => x.outcome !== "UNSETTLED").length,
        credits_remaining: remainingCredits042(credit),
      },
      null,
      2,
    ),
  );
}

main();
