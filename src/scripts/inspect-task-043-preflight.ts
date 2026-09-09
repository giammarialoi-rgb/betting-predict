import { readdirSync, existsSync } from "node:fs";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { loadCreditState042 } from "@/domain/eval/collector-042/credit";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";

const root = storeRoot039();
const s = loadStore039(root);
const { status } = resolveDisplayedStatus042(root);
console.log(
  JSON.stringify(
    {
      root,
      events: s.events.length,
      quotes: s.quotes.length,
      decisions: s.decisions.length,
      settlements: s.settlements.length,
      sports: [...new Set(s.events.map((e) => e.sport_key))].sort(),
      markets: [...new Set(s.quotes.map((q) => q.market))].sort(),
      collectorStatus: status,
      creditRemaining: loadCreditState042(root).observedRemaining,
      files: existsSync(root) ? readdirSync(root).filter((f) => f !== "raw") : [],
    },
    null,
    2,
  ),
);
