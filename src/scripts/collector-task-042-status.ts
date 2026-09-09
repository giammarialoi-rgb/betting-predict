import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { collectorLogPath042, loadGovernorConfig042, sourceStore042 } from "@/domain/eval/collector-042/config";
import { isLockHeldByAliveProcess042, readProcessLock042 } from "@/domain/eval/collector-042/lock";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { nextKickoffs042 } from "@/domain/eval/collector-042/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

const mode = process.argv[2] ?? "status";

function main() {
  const root = sourceStore042();
  if (mode === "logs") {
    const p = collectorLogPath042(root);
    if (!existsSync(p)) {
      console.log("(no collector.log yet)");
      return;
    }
    const lines = readFileSync(p, "utf8").trim().split(/\n/);
    console.log(lines.slice(-40).join("\n"));
    return;
  }

  const { status, heartbeat, stale } = resolveDisplayedStatus042(root);
  const credit = loadCreditState042(root);
  const store = loadStore039(root);
  const lock = readProcessLock042(root);
  console.log(
    JSON.stringify(
      {
        displayedStatus: status,
        stale,
        lockAlive: isLockHeldByAliveProcess042(root),
        lock,
        heartbeat,
        credit: {
          ...credit,
          remainingEffective: remainingCredits042(credit),
        },
        store: {
          events: store.events.length,
          quotes: store.quotes.length,
          decisions: store.decisions.length,
          settlements: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
        },
        nextKickoffs: nextKickoffs042(store, 5),
        governor: loadGovernorConfig042(),
      },
      null,
      2,
    ),
  );
}

main();
