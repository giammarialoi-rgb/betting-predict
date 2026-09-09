import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import { normalizeMarketProbabilities } from "@/domain/odds/math";
import type { ModelRow023 } from "@/domain/eval/temporal-023/types";

export const MODEL_IDS_023 = [
  "MODEL_0_MARKET_ONLY",
  "MODEL_1_ELO",
  "MODEL_2_FORM",
  "MODEL_3_ELO_FORM",
  "MODEL_4_MARKET_ELO",
  "MODEL_5_MARKET_ELO_FORM",
  "MODEL_6_POISSON",
] as const;

export type ModelId023 = (typeof MODEL_IDS_023)[number];

export function marketOnlyProbs(odds: {
  home: number;
  draw: number;
  away: number;
}): [number, number, number] | null {
  if (odds.home <= 1 || odds.draw <= 1 || odds.away <= 1) return null;
  const p = normalizeMarketProbabilities([odds.home, odds.draw, odds.away]);
  return [p[0]!, p[1]!, p[2]!];
}

export function runModel023(input: {
  model: ModelId023;
  market: { home: number; draw: number; away: number } | null;
  eloAvailable: boolean;
  formAvailable: boolean;
}): { probs: [number, number, number] | null; note: string } {
  const m = input.market ? marketOnlyProbs(input.market) : null;
  switch (input.model) {
    case "MODEL_0_MARKET_ONLY":
      return m
        ? { probs: m, note: "de-vig last traded MATCH_ODDS (BASIC LTP)" }
        : { probs: null, note: "NO_DATA_AT_ASOF" };
    case "MODEL_1_ELO":
      return { probs: null, note: "ELO not in BASIC stream — INSUFFICIENT" };
    case "MODEL_2_FORM":
      return { probs: null, note: "FORM not in BASIC stream — INSUFFICIENT" };
    case "MODEL_3_ELO_FORM":
      return { probs: null, note: "ELO+FORM not in BASIC stream — INSUFFICIENT" };
    case "MODEL_4_MARKET_ELO":
      return {
        probs: null,
        note: "MARKET+ELO blocked: ELO missing (do not silently drop ELO)",
      };
    case "MODEL_5_MARKET_ELO_FORM":
      return {
        probs: null,
        note: "MARKET+ELO+FORM blocked: ELO/FORM missing",
      };
    case "MODEL_6_POISSON":
      return { probs: null, note: "Poisson goals model not identifiable from LTP-only BASIC" };
    default:
      return { probs: null, note: "unknown model" };
  }
}

export function modelCompareRows(input: {
  market: { home: number; draw: number; away: number } | null;
  actual: 0 | 1 | 2 | null;
  clv: number | null;
}): ModelRow023[] {
  return MODEL_IDS_023.map((model) => {
    const run = runModel023({
      model,
      market: input.market,
      eloAvailable: false,
      formAvailable: false,
    });
    let brier: number | null = null;
    let logloss: number | null = null;
    if (run.probs && input.actual != null) {
      brier = brier3(run.probs, input.actual);
      logloss = logLoss3(run.probs, input.actual);
    }
    return {
      model,
      n: run.probs && input.actual != null ? 1 : 0,
      brier,
      logloss,
      calibration: "n=1 insufficient",
      roi_diagnostic: null,
      clv: model === "MODEL_0_MARKET_ONLY" ? input.clv : null,
      max_dd: null,
      used_for_capital: false,
      significant: false,
      note: run.note,
    };
  });
}

export function actualIndex(winner: "HOME" | "DRAW" | "AWAY" | "OTHER" | null): 0 | 1 | 2 | null {
  if (winner === "HOME") return 0;
  if (winner === "DRAW") return 1;
  if (winner === "AWAY") return 2;
  return null;
}
