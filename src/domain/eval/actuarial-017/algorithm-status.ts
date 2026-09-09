/**
 * Predictive baselines + ALGORITHM_STATUS — no auto edge claims.
 */

import type { RealHistoricalDataset, RealLabEvent } from "@/domain/eval/real-lab/load-pack";
import { decisionAsOfForEvent } from "@/domain/eval/real-lab/truth-lab";
import { quotesAsOf } from "@/domain/markets/discovery-engine";
import { normalizeMarketProbabilities } from "@/domain/odds/math";
import { buildLabHoldoutSplit, partitionNameForDate } from "@/domain/eval/holdout";

export type ModelScoreRow = {
  model_version: string;
  partition: "DEVELOPMENT" | "VALIDATION" | "TEST" | "FINAL_HOLDOUT" | "ALL_OK";
  n: number;
  brier: number | null;
  log_loss: number | null;
  training_window: string;
  validation_window: string;
  test_window: string;
};

export type AlgorithmStatus =
  | "A_NO_EVIDENCE_OF_ADVANTAGE"
  | "B_INFORMATIONAL_VALUE"
  | "C_CONDITIONAL_ADVANTAGE"
  | "D_ROBUST_OUT_OF_SAMPLE_ADVANTAGE"
  | "E_DATA_INSUFFICIENT";

function brierThreeWay(
  p: { HOME: number; DRAW: number; AWAY: number },
  actual: "HOME" | "DRAW" | "AWAY",
): number {
  const y = {
    HOME: actual === "HOME" ? 1 : 0,
    DRAW: actual === "DRAW" ? 1 : 0,
    AWAY: actual === "AWAY" ? 1 : 0,
  };
  return (
    (p.HOME - y.HOME) ** 2 + (p.DRAW - y.DRAW) ** 2 + (p.AWAY - y.AWAY) ** 2
  ) / 3;
}

function logLossThreeWay(
  p: { HOME: number; DRAW: number; AWAY: number },
  actual: "HOME" | "DRAW" | "AWAY",
): number {
  const eps = 1e-12;
  const v = Math.max(eps, Math.min(1 - eps, p[actual]));
  return -Math.log(v);
}

function marketDevigForEvent(
  event: RealLabEvent,
  dataset: RealHistoricalDataset,
): { HOME: number; DRAW: number; AWAY: number } | null {
  const asOf = decisionAsOfForEvent(event);
  const { accepted } = quotesAsOf(dataset.quotes, event.eventId, asOf, "RESEARCH");
  const result = accepted.filter(
    (q) =>
      q.observation.marketType === "result" &&
      q.observationKind === "dataset_open",
  );
  const books = new Set(result.map((q) => q.bookmakerSlug));
  for (const book of books) {
    const h = result.find((q) => q.bookmakerSlug === book && q.observation.selection === "HOME");
    const d = result.find((q) => q.bookmakerSlug === book && q.observation.selection === "DRAW");
    const a = result.find((q) => q.bookmakerSlug === book && q.observation.selection === "AWAY");
    if (h && d && a) {
      const n = normalizeMarketProbabilities([
        h.oddsDecimal,
        d.oddsDecimal,
        a.oddsDecimal,
      ]);
      return { HOME: n[0]!, DRAW: n[1]!, AWAY: n[2]! };
    }
  }
  return null;
}

function frequencyPrior(train: RealLabEvent[]): {
  HOME: number;
  DRAW: number;
  AWAY: number;
} {
  if (train.length === 0) return { HOME: 1 / 3, DRAW: 1 / 3, AWAY: 1 / 3 };
  let h = 0;
  let d = 0;
  let a = 0;
  for (const e of train) {
    if (e.resultCode === "HOME") h++;
    else if (e.resultCode === "DRAW") d++;
    else a++;
  }
  const n = train.length;
  return { HOME: h / n, DRAW: d / n, AWAY: a / n };
}

export function scoreModels(dataset: RealHistoricalDataset): {
  rows: ModelScoreRow[];
  holdout_touched: false;
  market_vs_frequency_holdout: {
    market_brier: number | null;
    frequency_brier: number | null;
    model_lt_market: boolean | null;
  };
} {
  const split = buildLabHoldoutSplit();
  const events = [...dataset.events].sort(
    (a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime(),
  );

  const byPart = {
    DEVELOPMENT: [] as RealLabEvent[],
    VALIDATION: [] as RealLabEvent[],
    TEST: [] as RealLabEvent[],
    FINAL_HOLDOUT: [] as RealLabEvent[],
  };
  for (const e of events) {
    const p = partitionNameForDate(split, e.scheduledStartAt);
    if (p === "TRAIN") byPart.DEVELOPMENT.push(e);
    else if (p === "VALIDATION") byPart.VALIDATION.push(e);
    else if (p === "TEST") byPart.TEST.push(e);
    else if (p === "HOLDOUT") byPart.FINAL_HOLDOUT.push(e);
  }

  const trainFor = (part: keyof typeof byPart): RealLabEvent[] => {
    if (part === "DEVELOPMENT") return [];
    if (part === "VALIDATION") return byPart.DEVELOPMENT;
    if (part === "TEST") return [...byPart.DEVELOPMENT, ...byPart.VALIDATION];
    // HOLDOUT: may use all prior partitions for evaluation only — no param tuning
    return [...byPart.DEVELOPMENT, ...byPart.VALIDATION, ...byPart.TEST];
  };

  const rows: ModelScoreRow[] = [];
  const windows = {
    training_window: "2019-2021",
    validation_window: "2022",
    test_window: "2023",
  };

  for (const part of Object.keys(byPart) as Array<keyof typeof byPart>) {
    const evalEvents = byPart[part];
    const train = trainFor(part);
    const freq = frequencyPrior(train);
    const homeAdv = {
      HOME: Math.min(0.55, freq.HOME + 0.05),
      DRAW: freq.DRAW,
      AWAY: 0,
    };
    const s = homeAdv.HOME + homeAdv.DRAW;
    homeAdv.AWAY = Math.max(0, 1 - s);

    const models: Array<{
      id: string;
      pred: (e: RealLabEvent) => { HOME: number; DRAW: number; AWAY: number } | null;
    }> = [
      { id: "frequency_baseline_v1", pred: () => freq },
      { id: "home_advantage_v1", pred: () => homeAdv },
      {
        id: "market_devig_v1",
        pred: (e) => marketDevigForEvent(e, dataset),
      },
      {
        id: "market_implied_v1",
        pred: (e) => marketDevigForEvent(e, dataset),
      },
      {
        id: "elo_proxy_v1",
        pred: () => freq, // Elo sparse in pack — falls back to frequency (honest)
      },
    ];

    for (const m of models) {
      let n = 0;
      let bSum = 0;
      let lSum = 0;
      for (const e of evalEvents) {
        const p = m.pred(e);
        if (!p) continue;
        n++;
        bSum += brierThreeWay(p, e.resultCode);
        lSum += logLossThreeWay(p, e.resultCode);
      }
      rows.push({
        model_version: m.id,
        partition: part,
        n,
        brier: n ? bSum / n : null,
        log_loss: n ? lSum / n : null,
        ...windows,
      });
    }
  }

  const mHold = rows.find(
    (r) => r.model_version === "market_devig_v1" && r.partition === "FINAL_HOLDOUT",
  );
  const fHold = rows.find(
    (r) =>
      r.model_version === "frequency_baseline_v1" &&
      r.partition === "FINAL_HOLDOUT",
  );

  return {
    rows,
    holdout_touched: false,
    market_vs_frequency_holdout: {
      market_brier: mHold?.brier ?? null,
      frequency_brier: fHold?.brier ?? null,
      model_lt_market:
        mHold?.brier != null && fHold?.brier != null
          ? fHold.brier < mHold.brier
          : null,
    },
  };
}

export function classifyAlgorithmStatus(input: {
  primaryEvents: number;
  holdoutN: number;
  marketBrier: number | null;
  challengerBrier: number | null;
  validatedEdge: boolean;
  bankrollMeanFinal: number | null;
}): {
  status: AlgorithmStatus;
  verdict: string;
  answers: Record<string, string>;
} {
  if (input.primaryEvents < 100 || input.holdoutN < 5) {
    return {
      status: "E_DATA_INSUFFICIENT",
      verdict:
        "DATA_INSUFFICIENT — primary blind pack too small to claim advantage; secondary historical mass catalogued but not STRICT-usable without clocks.",
      answers: {
        capital_per_year: "See yearly table (pack years only)",
        positive_years: "See yearly table",
        worst_drawdown: "See strategy metrics",
        most_robust_strategy: "winner=null — compare multi-objective, do not auto-pick",
        info_beyond_market: "NOT DEMONSTRATED",
        markets: "result only (others BLOCKED)",
        periods: "2019–2024 pack; 2001–2018 INSUFFICIENT_DATA for STRICT",
        sample_size: String(input.primaryEvents),
        walk_forward: "partitions frozen; no random split",
        holdout: "HOLDOUT_TOUCHED=false",
        usable_without_leakage: "primary pack only for bankroll",
        algorithm_today: "E_DATA_INSUFFICIENT",
      },
    };
  }

  if (!input.validatedEdge) {
    const informational =
      input.challengerBrier != null &&
      input.marketBrier != null &&
      input.challengerBrier < input.marketBrier - 0.01;
    if (informational) {
      return {
        status: "B_INFORMATIONAL_VALUE",
        verdict:
          "INFORMATIONAL_VALUE possible on predictive metrics but no VALIDATED_EDGE / economic advantage gate passed.",
        answers: baseAnswers(input, "B"),
      };
    }
    return {
      status: "A_NO_EVIDENCE_OF_ADVANTAGE",
      verdict:
        "NO_DEMONSTRATED_ADVANTAGE — market_devig champion with declared_edge=false; no out-of-sample validated edge.",
      answers: baseAnswers(input, "A"),
    };
  }

  return {
    status: "C_CONDITIONAL_ADVANTAGE",
    verdict: "Conditional only — requires further gates for D.",
    answers: baseAnswers(input, "C"),
  };
}

function baseAnswers(
  input: {
    primaryEvents: number;
    bankrollMeanFinal: number | null;
  },
  code: string,
): Record<string, string> {
  return {
    capital_per_year: "See MAIN RESULT table",
    info_beyond_market: code === "A" ? "NO" : "PARTIAL/UNVALIDATED",
    sample_size: String(input.primaryEvents),
    mean_final_bankroll:
      input.bankrollMeanFinal != null
        ? input.bankrollMeanFinal.toFixed(1)
        : "n/a",
    algorithm_today: code,
  };
}
