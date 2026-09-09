/**
 * Settlement for observed markets only. Called after LOCK.
 */

export type Outcome020 = {
  ftHome: number;
  ftAway: number;
};

export function settleObservedMarket(input: {
  marketType: string;
  line: number | null;
  selection: string;
  odds: number;
  stake: number;
  outcome: Outcome020;
}): { pnl: number; result: "WIN" | "LOSS" | "PUSH" } {
  const won = selectionWon(input);
  if (won === "PUSH") return { pnl: 0, result: "PUSH" };
  if (won) return { pnl: input.stake * (input.odds - 1), result: "WIN" };
  return { pnl: -input.stake, result: "LOSS" };
}

function selectionWon(input: {
  marketType: string;
  line: number | null;
  selection: string;
  outcome: Outcome020;
}): boolean | "PUSH" {
  const { ftHome, ftAway } = input.outcome;
  if (input.marketType === "1X2") {
    if (input.selection === "HOME") return ftHome > ftAway;
    if (input.selection === "DRAW") return ftHome === ftAway;
    if (input.selection === "AWAY") return ftAway > ftHome;
    return false;
  }
  if (input.marketType === "TOTAL_GOALS") {
    const line = input.line ?? 2.5;
    const goals = ftHome + ftAway;
    if (goals === line) return "PUSH";
    if (input.selection === "OVER") return goals > line;
    if (input.selection === "UNDER") return goals < line;
    return false;
  }
  if (input.marketType === "ASIAN_HANDICAP") {
    const line = input.line ?? 0;
    const adj = ftHome + line - ftAway;
    if (adj === 0) return "PUSH";
    if (input.selection === "HOME") return adj > 0;
    if (input.selection === "AWAY") return adj < 0;
    return false;
  }
  throw new Error(`SETTLEMENT_UNSUPPORTED: ${input.marketType}`);
}
