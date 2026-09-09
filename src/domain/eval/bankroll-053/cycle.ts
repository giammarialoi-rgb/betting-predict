import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { runBrainCycle051 } from "@/domain/eval/brain-051/cycle";
import { ensureBankrollDirs053, loadExp053Config } from "@/domain/eval/bankroll-053/config";
import {
  maybeOpenVirtualBets053,
  settleVirtualBets053,
  summarizeBankroll053,
} from "@/domain/eval/bankroll-053/ledger";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import { appendActivity051 } from "@/domain/eval/brain-051/health";

function latestDecisions(root: string): DecisionRecord048[] {
  const p = join(root, "decisions.jsonl");
  if (!existsSync(p)) return [];
  const latest = new Map<string, DecisionRecord048>();
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const d = JSON.parse(line) as DecisionRecord048;
      const prev = latest.get(d.event_id);
      if (!prev || d.timestamp >= prev.timestamp) latest.set(d.event_id, d);
    } catch {
      /* skip */
    }
  }
  return [...latest.values()];
}

export type MassiveBankrollCycle053 = {
  brain: Awaited<ReturnType<typeof runBrainCycle051>>;
  virtual_opens: number;
  virtual_settles: number;
  bankroll: ReturnType<typeof summarizeBankroll053>;
};

/** Brain cycle + virtual bankroll open/settle. Lab should pass allowDiscover:false. */
export async function runMassiveBankrollCycle053(input: {
  forceDiscover?: boolean;
  allowDiscover?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
} = {}): Promise<MassiveBankrollCycle053> {
  loadExp053Config();
  const root = permanentRoot044();
  ensurePermanentDirs044(root);
  ensureBankrollDirs053(root);
  const nowIso = input.nowIso ?? new Date().toISOString();

  const brain = await runBrainCycle051({
    forceDiscover: input.forceDiscover,
    allowDiscover: input.allowDiscover,
    fetchImpl: input.fetchImpl,
    nowIso,
  });

  const store = loadStore044(root);
  const settle = settleVirtualBets053({
    root,
    settlements: store.settlements,
    nowIso,
  });

  let opens = 0;
  for (const d of latestDecisions(root)) {
    opens += maybeOpenVirtualBets053({ root, decision: d, nowIso }).length;
  }

  if (opens || settle.settled) {
    appendActivity051(
      root,
      "VIRTUAL_BANKROLL",
      `opens=${opens} settles=${settle.settled} flat=${settle.state.strategies.FLAT.bankroll}`,
    );
  }

  return {
    brain,
    virtual_opens: opens,
    virtual_settles: settle.settled,
    bankroll: summarizeBankroll053(root),
  };
}
