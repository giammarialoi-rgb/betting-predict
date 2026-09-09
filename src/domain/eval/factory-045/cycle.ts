import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadExp045Config } from "@/domain/eval/factory-045/config";
import { runDiscover045 } from "@/domain/eval/factory-045/discover";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";
import { runSettle045 } from "@/domain/eval/factory-045/settle";
import { writeDailyFactory045 } from "@/domain/eval/factory-045/daily";

export type FactoryCycle045 = {
  seed_sync: Awaited<ReturnType<typeof runPermanent044Cycle>> | null;
  discovery: Awaited<ReturnType<typeof runDiscover045>> | null;
  analyze: ReturnType<typeof analyzeAllLabB045> | null;
  settle: Awaited<ReturnType<typeof runSettle045>> | null;
  daily: ReturnType<typeof writeDailyFactory045>;
  totals: {
    TOTAL_EVENTS: number;
    SEED: number;
    DISCOVERED_LIVE: number;
    SOCCER: number;
    TENNIS: number;
    PREDICTIONS: number;
    LOCKS: number;
  };
};

export async function runFactory045Cycle(input: {
  discover?: boolean;
  settle?: boolean;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
  maxSports?: number;
  nowIso?: string;
} = {}): Promise<FactoryCycle045> {
  loadExp045Config();
  const labB = permanentRoot044();
  const labA = labAStore044();
  const nowIso = input.nowIso ?? new Date().toISOString();

  // 1) Sync Lab A seed into Lab B (never modifies Lab A)
  const seed_sync = await runPermanent044Cycle({
    labARoot: labA,
    permanentRoot: labB,
    runCollector042: false,
    nowIso,
  });

  // 2) Independent discovery into Lab B (growth beyond 114)
  let discovery = null;
  if (input.discover !== false) {
    discovery = await runDiscover045({
      labBRoot: labB,
      labARoot: labA,
      force: input.forceDiscovery,
      fetchImpl: input.fetchImpl,
      maxSports: input.maxSports,
      nowIso,
    });
  }

  // 3) Analyze ALL Lab B events (seed + discovered)
  const store = loadStore044(labB);
  const analyze = analyzeAllLabB045({ store, nowIso });

  // 4) Settle past kickoffs in Lab B
  let settle = null;
  if (input.settle !== false) {
    settle = await runSettle045({
      labBRoot: labB,
      labARoot: labA,
      fetchImpl: input.fetchImpl,
      nowIso,
    });
  }

  const store2 = loadStore044(labB);
  const daily = writeDailyFactory045(store2, nowIso.slice(0, 10));

  return {
    seed_sync,
    discovery,
    analyze,
    settle,
    daily,
    totals: {
      TOTAL_EVENTS: store2.events.length,
      SEED: store2.events.filter((e) => e.origin === "LAB_A_SEED" || e.origin == null).length,
      DISCOVERED_LIVE: store2.events.filter((e) => e.origin === "DISCOVERED_LIVE").length,
      SOCCER: store2.events.filter((e) => e.sport === "soccer").length,
      TENNIS: store2.events.filter((e) => e.sport === "tennis").length,
      PREDICTIONS: store2.predictions.length,
      LOCKS: store2.locks.length,
    },
  };
}
