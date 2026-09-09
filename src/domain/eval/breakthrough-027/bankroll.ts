import type { AnnualRow027 } from "@/domain/eval/breakthrough-027/types";
import { STRICT_EVENT_GATE } from "@/domain/eval/breakthrough-027/types";
import type { Replay027 } from "@/domain/eval/breakthrough-027/replay";

export function annualFromReplay027(input: {
  years: readonly number[];
  replay: Replay027;
  datasetLabel: string;
  primaryStrategy: string;
}): AnnualRow027[] {
  return input.years.map((year) => {
    const r = input.replay.byYear.get(year);
    const incomplete = year >= 2026;
    const strict = r?.strict ?? 0;
    const events = r?.events ?? 0;
    const decisions = r?.decisions ?? 0;
    const bets = r?.bets ?? 0;
    if (bets === 0) {
      return {
        year,
        dataset: input.datasetLabel,
        events,
        strict,
        decisions,
        bets: 0,
        start: 1000,
        end: null,
        pnl: null,
        roi: null,
        max_dd: null,
        brier: r?.brier ?? null,
        logloss: r?.logloss ?? null,
        strategy: null,
        status: incomplete ? "INCOMPLETE" : strict >= STRICT_EVENT_GATE ? "NO_BET" : "INSUFFICIENT_DATA",
      };
    }
    return {
      year,
      dataset: input.datasetLabel,
      events,
      strict,
      decisions,
      bets,
      start: 1000,
      end: r!.end,
      pnl: r!.pnl,
      roi: r!.roi,
      max_dd: r!.maxDd,
      brier: r!.brier,
      logloss: r!.logloss,
      strategy: input.primaryStrategy,
      status: "VALID",
    };
  });
}

export function assertNoSilentThousand027(rows: readonly AnnualRow027[]): void {
  for (const row of rows) {
    if (row.bets === 0 && row.end != null) {
      throw new Error(`silent bankroll end for ${row.year}`);
    }
    if (row.strict < STRICT_EVENT_GATE && row.status === "VALID") {
      throw new Error(`VALID without gate ${row.year}`);
    }
  }
}
