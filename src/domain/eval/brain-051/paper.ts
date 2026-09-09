import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";

export type PaperBet051 = {
  paper_bet_id: string;
  event_id: string;
  prediction_id: string;
  selection: string | null;
  market: string;
  odds: number | null;
  timestamp: string;
  model_probability: number | null;
  stake_virtual: number;
  result: "OPEN" | "WON" | "LOST" | "PUSH" | "VOID";
  pnl_virtual: number | null;
  capital: "PAPER_ONLY";
  real_money: false;
  note: string;
};

/** Paper bets only — never real money. Deduped by prediction_id. */
export function maybeOpenPaperBet051(input: {
  root: string;
  decision: DecisionRecord048;
  nowIso: string;
}): PaperBet051 | null {
  if (input.decision.decision !== "BET_CANDIDATE" && input.decision.decision !== "STRONG_CANDIDATE") {
    return null;
  }
  const id = createHash("sha256")
    .update(`paper051|${input.decision.prediction_id}`)
    .digest("hex")
    .slice(0, 24);
  const path = join(input.root, "paper-bets.jsonl");
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const j = JSON.parse(line) as { paper_bet_id?: string; prediction_id?: string };
        if (j.paper_bet_id === id || j.prediction_id === input.decision.prediction_id) return null;
      } catch {
        /* skip */
      }
    }
  }
  const fair = input.decision.fair_probability;
  const odds = fair != null && fair > 0 ? Number((1 / fair).toFixed(3)) : null;
  const rec: PaperBet051 = {
    paper_bet_id: id,
    event_id: input.decision.event_id,
    prediction_id: input.decision.prediction_id,
    selection: input.decision.prediction,
    market: input.decision.market,
    odds,
    timestamp: input.nowIso,
    model_probability: input.decision.probability,
    stake_virtual: 1,
    result: "OPEN",
    pnl_virtual: null,
    capital: "PAPER_ONLY",
    real_money: false,
    note: "Virtual stake only — CAPITAL CLOSED — not a real bet",
  };
  appendJsonl044(path, rec);
  return rec;
}
