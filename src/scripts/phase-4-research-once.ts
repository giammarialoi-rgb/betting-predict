/**
 * Run a budgeted research cycle then print queue counts.
 * Does not invent fixture IDs. Does not lower gates.
 */
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { runEventResearchOrchestrator } from "@/domain/eval/data-intelligence/research/orchestrator";

async function main() {
  const root = permanentRoot044();
  const store = loadStore044(root);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const budget = Number(process.argv[2] ?? 8);
  const result = await runEventResearchOrchestrator({
    events: store.events,
    nowIso,
    nowMs,
    cycleNumber: null,
    labBRoot: root,
    budget: Number.isFinite(budget) ? budget : 8,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
