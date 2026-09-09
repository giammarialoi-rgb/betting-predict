import { STRICT_EVENT_GATE, type AnnualRow026 } from "@/domain/eval/bottleneck-026/types";

export function annualBankroll026(input: {
  years: readonly number[];
  eventsByYear: ReadonlyMap<number, number>;
  strictByYear: ReadonlyMap<number, number>;
  decisionsByYear: ReadonlyMap<number, number>;
  betsByYear: ReadonlyMap<number, number>;
}): AnnualRow026[] {
  return input.years.map((year) => {
    const strict = input.strictByYear.get(year) ?? 0;
    const events = input.eventsByYear.get(year) ?? 0;
    const decisions = input.decisionsByYear.get(year) ?? 0;
    const bets = input.betsByYear.get(year) ?? 0;
    const incomplete = year >= 2026;
    if (bets > 0) {
      throw new Error("TASK 026 must not settle capital while declared_edge=false");
    }
    return {
      year,
      events,
      strict,
      decisions,
      bets,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      model: null,
      status: incomplete ? "INCOMPLETE" : "INSUFFICIENT_DATA",
    };
  });
}

export function assertNoSilentThousand(rows: readonly AnnualRow026[]): void {
  for (const row of rows) {
    if (row.bets === 0 && row.end != null) {
      throw new Error(`silent bankroll end for ${row.year}`);
    }
    if (row.strict < STRICT_EVENT_GATE && row.status === "VALID") {
      throw new Error(`VALID without gate ${row.year}`);
    }
  }
}
