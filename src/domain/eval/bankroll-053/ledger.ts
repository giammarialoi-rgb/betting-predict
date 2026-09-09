import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import type { PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import {
  STRATEGIES_053,
  bankrollLedgerPath053,
  ensureBankrollDirs053,
  loadBankrollState053,
  saveBankrollState053,
  type StakeStrategy053,
  type VirtualBankrollState053,
} from "@/domain/eval/bankroll-053/config";
import { computeStake053, ledgerId053, settlePnL053 } from "@/domain/eval/bankroll-053/stake";
import { expectedValue056 } from "@/domain/eval/audit-056/math";
import { mapBetOutcome053 } from "@/domain/eval/predictive-intelligence/settlement/outcome-map";

export type VirtualLedgerEntry053 = {
  entry_id: string;
  kind: "OPEN" | "SETTLE";
  strategy: StakeStrategy053;
  event_id: string;
  prediction_id: string;
  decision_id: string;
  selection: string | null;
  market: string;
  odds: number | null;
  model_probability: number | null;
  market_probability: number | null;
  edge: number | null;
  ev: number | null;
  model_version: string | null;
  feature_snapshot_ref: string | null;
  why: string | null;
  bankroll_before: number;
  stake: number;
  result: "OPEN" | "WON" | "LOST" | "PUSH" | "VOID";
  profit_loss: number | null;
  bankroll_after: number | null;
  timestamp: string;
  capital: "VIRTUAL_ONLY";
  real_money: false;
  simulation_only: true;
  scientifically_qualified: false;
  note: string;
};

function readLedger(root: string): VirtualLedgerEntry053[] {
  const p = bankrollLedgerPath053(root);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l.replace(/^\uFEFF/, "")) as VirtualLedgerEntry053;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as VirtualLedgerEntry053[];
}

function hasEntry(root: string, entryId: string): boolean {
  return readLedger(root).some((e) => e.entry_id === entryId);
}

/** Open virtual bets for BET/STRONG candidates across all strategies. */
export function maybeOpenVirtualBets053(input: {
  root: string;
  decision: DecisionRecord048;
  nowIso: string;
}): VirtualLedgerEntry053[] {
  if (input.decision.decision !== "BET_CANDIDATE" && input.decision.decision !== "STRONG_CANDIDATE") {
    return [];
  }
  ensureBankrollDirs053(input.root);
  const state = loadBankrollState053(input.root);
  const fair = input.decision.fair_probability;
  const odds = fair != null && fair > 0 ? Number((1 / fair).toFixed(3)) : null;
  const opened: VirtualLedgerEntry053[] = [];

  for (const strategy of STRATEGIES_053) {
    const entry_id = ledgerId053("open", strategy, input.decision.prediction_id);
    if (hasEntry(input.root, entry_id)) continue;
    const st = state.strategies[strategy];
    const sizing = computeStake053({
      strategy,
      bankroll: st.bankroll,
      probability: input.decision.probability,
      odds,
    });
    if (sizing.stake <= 0) continue;
    const marketP = input.decision.market_probability;
    const modelP = input.decision.probability;
    const edge = input.decision.estimated_edge;
    const ev = modelP != null && odds != null ? expectedValue056(modelP, odds) : null;
    const rec: VirtualLedgerEntry053 = {
      entry_id,
      kind: "OPEN",
      strategy,
      event_id: input.decision.event_id,
      prediction_id: input.decision.prediction_id,
      decision_id: input.decision.decision_id,
      selection: input.decision.prediction,
      market: input.decision.market,
      odds,
      model_probability: modelP,
      market_probability: marketP,
      edge,
      ev,
      model_version: input.decision.model_version,
      feature_snapshot_ref: input.decision.prediction_id,
      why: input.decision.explanation?.WHY_PRIMARY ?? null,
      bankroll_before: st.bankroll,
      stake: sizing.stake,
      result: "OPEN",
      profit_loss: null,
      bankroll_after: null,
      timestamp: input.nowIso,
      capital: "VIRTUAL_ONLY",
      real_money: false,
      simulation_only: true,
      scientifically_qualified: false,
      note: `SIMULATION_ONLY — ${sizing.reason} — not scientifically qualified`,
    };
    appendJsonl044(bankrollLedgerPath053(input.root), rec);
    opened.push(rec);
  }
  if (opened.length) {
    state.updated_at = input.nowIso;
    saveBankrollState053(input.root, state);
  }
  return opened;
}

/** Settle open virtual bets from Lab B settlements (idempotent). */
export function settleVirtualBets053(input: {
  root: string;
  settlements: PermanentSettlement044[];
  nowIso: string;
}): { settled: number; state: VirtualBankrollState053 } {
  ensureBankrollDirs053(input.root);
  const state = loadBankrollState053(input.root);
  const ledger = readLedger(input.root);
  const settledIds = new Set(ledger.filter((e) => e.kind === "SETTLE").map((e) => e.entry_id));
  const openByKey = new Map<string, VirtualLedgerEntry053>();
  for (const e of ledger) {
    if (e.kind !== "OPEN") continue;
    openByKey.set(`${e.strategy}|${e.prediction_id}`, e);
  }

  let settled = 0;
  for (const s of input.settlements) {
    // Prefer result|1X2 mapping per open selection — never trust a blanket "won"
    for (const strategy of STRATEGIES_053) {
      for (const [key, open] of openByKey) {
        if (!key.startsWith(`${strategy}|`)) continue;
        if (open.event_id !== s.event_id) continue;
        const settleId = ledgerId053("settle", strategy, open.prediction_id, s.settled_at);
        if (settledIds.has(settleId)) continue;
        const mapped = mapBetOutcome053({ result: s.result, selection: open.selection });
        const outcome =
          mapped !== "UNSETTLED"
            ? mapped
            : s.outcome === "won" || s.outcome === "lost" || s.outcome === "push" || s.outcome === "void"
              ? s.outcome
              : "UNSETTLED";
        const { pnl, result } = settlePnL053({
          stake: open.stake,
          odds: open.odds,
          outcome,
        });
        if (result === "OPEN") continue;
        const st = state.strategies[strategy];
        const before = st.bankroll;
        const after = Number((before + pnl).toFixed(4));
        st.bankroll = after;
        st.peak = Math.max(st.peak, after);
        const dd = st.peak > 0 ? (st.peak - after) / st.peak : 0;
        st.max_drawdown = Math.max(st.max_drawdown, dd);
        st.bets += 1;
        st.profit = Number((st.profit + pnl).toFixed(4));
        if (result === "WON") st.wins += 1;
        else if (result === "LOST") st.losses += 1;
        else st.pushes += 1;

        const rec: VirtualLedgerEntry053 = {
          ...open,
          entry_id: settleId,
          kind: "SETTLE",
          bankroll_before: before,
          result,
          profit_loss: pnl,
          bankroll_after: after,
          timestamp: input.nowIso,
          note: "SIMULATION_ONLY settle — REAL_MONEY=false — not a scientific edge claim",
        };
        appendJsonl044(bankrollLedgerPath053(input.root), rec);
        settledIds.add(settleId);
        settled += 1;
      }
    }
  }
  state.updated_at = input.nowIso;
  saveBankrollState053(input.root, state);
  return { settled, state };
}

export function summarizeBankroll053(root: string) {
  const state = loadBankrollState053(root);
  const flat = state.strategies.FLAT;
  const roi = flat.bets > 0 ? flat.profit / state.initial : 0;
  return {
    title: "VIRTUAL BANKROLL 1000",
    initial: state.initial,
    current_flat: flat.bankroll,
    profit_flat: flat.profit,
    roi_flat: Number(roi.toFixed(6)),
    max_drawdown_flat: flat.max_drawdown,
    strategies: state.strategies,
    capital: state.capital,
    real_money: false as const,
    auto_promotion: false as const,
    qualification: state.qualification,
    model_edge: "UNKNOWN" as const,
    scientifically_qualified: false as const,
    open_entries: readLedger(root).filter((e) => e.kind === "OPEN").length,
    settle_entries: readLedger(root).filter((e) => e.kind === "SETTLE").length,
    updated_at: state.updated_at,
  };
}

/** Goal simulator — informational only, never promises reachability. */
export function simulateGoal053(input: {
  start?: number;
  goal?: number;
  horizon_days?: number;
  avg_edge?: number | null;
  win_rate?: number | null;
  avg_odds?: number | null;
  settled_bets?: number;
}): {
  start: number;
  goal: number;
  horizon_days: number;
  scenarios: {
    name: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
    stake_fraction: number;
    expected_events: number;
    expected_profit: number | null;
    reach_goal_plausible: boolean | null;
    note: string;
  }[];
  disclaimer: string;
} {
  const start = input.start ?? 1000;
  const goal = input.goal ?? 3000;
  const horizon_days = input.horizon_days ?? 7;
  const hasStats = (input.settled_bets ?? 0) >= 100 && input.avg_edge != null && input.win_rate != null;
  const scenarios = (
    [
      ["CONSERVATIVE", 0.005, 14],
      ["BALANCED", 0.01, 21],
      ["AGGRESSIVE", 0.025, 35],
    ] as const
  ).map(([name, frac, events]) => {
    if (!hasStats) {
      return {
        name,
        stake_fraction: frac,
        expected_events: events,
        expected_profit: null as number | null,
        reach_goal_plausible: null as boolean | null,
        note: "INSUFFICIENT_SETTLED — SIMULATION_ONLY — cannot claim reachability",
      };
    }
    const edge = input.avg_edge!;
    const expected = start * frac * events * edge;
    const after = start + expected;
    return {
      name,
      stake_fraction: frac,
      expected_events: events,
      expected_profit: Number(expected.toFixed(2)),
      reach_goal_plausible: after >= goal,
      note: after >= goal ? "PLAUSIBLE_UNDER_ASSUMPTIONS_ONLY" : "NOT_REALISTIC_UNDER_CURRENT_ASSUMPTIONS",
    };
  });
  return {
    start,
    goal,
    horizon_days,
    scenarios,
    disclaimer:
      "VIRTUAL ONLY — NOT A PROMISE — MODEL_EDGE UNKNOWN until scientific gates — REAL_MONEY=false",
  };
}

export function loadOpenVirtualByEvent053(root: string, eventId: string): VirtualLedgerEntry053[] {
  return readLedger(root).filter((e) => e.event_id === eventId && e.kind === "OPEN");
}
