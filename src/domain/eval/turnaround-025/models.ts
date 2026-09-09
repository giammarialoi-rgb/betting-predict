import { brier3 } from "@/domain/eval/capital-020/models";
import { normalizeMarketProbabilities } from "@/domain/odds/math";

export const BASELINE_025 = "market_devig" as const;

export type ModelId025 =
  | "market_devig"
  | "frequency"
  | "home_advantage"
  | "elo"
  | "form"
  | "elo_form"
  | "poisson"
  | "market_elo"
  | "market_elo_form"
  | "market_microstructure";

export type Stage1Input = {
  marketOdds: { home: number; draw: number; away: number } | null;
  freq: [number, number, number];
  formHomePts: number;
  formAwayPts: number;
  formSample: number;
  eloDiff: number | null;
  gfHome: number;
  gaHome: number;
  gfAway: number;
  gaAway: number;
  microstructureAvailable: boolean;
};

export function marketDevig(odds: { home: number; draw: number; away: number }): [number, number, number] | null {
  if (odds.home <= 1 || odds.draw <= 1 || odds.away <= 1) return null;
  const p = normalizeMarketProbabilities([odds.home, odds.draw, odds.away]);
  return [p[0]!, p[1]!, p[2]!];
}

function norm(h: number, d: number, a: number): [number, number, number] {
  const s = h + d + a;
  if (s <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [h / s, d / s, a / s];
}

export function stage1Probability(id: ModelId025, input: Stage1Input): [number, number, number] | null {
  const mkt = input.marketOdds ? marketDevig(input.marketOdds) : null;
  if (id === "market_devig") return mkt;
  if (id === "frequency") return input.freq;
  if (id === "home_advantage") {
    return norm(input.freq[0]! * 0.85 + 0.15 * 0.46, input.freq[1]! * 0.85 + 0.15 * 0.26, input.freq[2]! * 0.85 + 0.15 * 0.28);
  }
  if (id === "form") {
    if (input.formSample < 3) return input.freq;
    const hp = input.formHomePts / (3 * input.formSample);
    const ap = input.formAwayPts / (3 * input.formSample);
    return norm(input.freq[0]! * 0.7 + hp * 0.3, input.freq[1]!, input.freq[2]! * 0.7 + ap * 0.3);
  }
  if (id === "elo") {
    if (input.eloDiff == null) return null;
    const pHome = 1 / (1 + 10 ** (-input.eloDiff / 400));
    return norm(pHome * 0.75, 0.25, (1 - pHome) * 0.75);
  }
  if (id === "elo_form") {
    const e = stage1Probability("elo", input);
    const f = stage1Probability("form", input);
    if (!e || !f) return e ?? f;
    return norm((e[0]! + f[0]!) / 2, (e[1]! + f[1]!) / 2, (e[2]! + f[2]!) / 2);
  }
  if (id === "poisson") {
    if (input.formSample < 3) return null;
    const n = Math.max(1, input.formSample);
    const lh = Math.max(0.2, (input.gfHome + input.gaAway) / (2 * n));
    const la = Math.max(0.2, (input.gfAway + input.gaHome) / (2 * n));
    let pH = 0;
    let pD = 0;
    let pA = 0;
    for (let h = 0; h <= 8; h++) {
      for (let a = 0; a <= 8; a++) {
        const p = poissonPmf(lh, h) * poissonPmf(la, a);
        if (h > a) pH += p;
        else if (h === a) pD += p;
        else pA += p;
      }
    }
    return norm(pH, pD, pA);
  }
  if (id === "market_elo" || id === "market_elo_form") {
    if (!mkt) return null;
    const other = stage1Probability(id === "market_elo" ? "elo" : "elo_form", input);
    if (!other) return null;
    return norm((mkt[0]! + other[0]!) / 2, (mkt[1]! + other[1]!) / 2, (mkt[2]! + other[2]!) / 2);
  }
  if (id === "market_microstructure") {
    return input.microstructureAvailable ? mkt : null;
  }
  return null;
}

function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export type Stage2Decision = {
  decision: "BET" | "NO_BET";
  candidate: boolean;
  reason: string;
  capitalEligible: boolean;
};

export function stage2Decision(input: {
  capitalEligible: boolean;
  declaredEdge: boolean;
  probs: [number, number, number] | null;
  market: [number, number, number] | null;
  threshold: number;
  trainN: number;
  minTrain: number;
  calibrationOk: boolean;
  liquidityOk: boolean;
  timestampStrict: boolean;
  evidenceGraph: boolean;
}): Stage2Decision {
  if (!input.evidenceGraph) {
    return { decision: "NO_BET", candidate: false, reason: "NO_EVIDENCE_GRAPH", capitalEligible: false };
  }
  if (!input.timestampStrict) {
    return {
      decision: "NO_BET",
      candidate: false,
      reason: "NO_STRICT_TIMESTAMP",
      capitalEligible: false,
    };
  }
  if (!input.capitalEligible) {
    return { decision: "NO_BET", candidate: false, reason: "NOT_CAPITAL_ELIGIBLE", capitalEligible: false };
  }
  if (!input.declaredEdge) {
    return { decision: "NO_BET", candidate: false, reason: "declared_edge=false", capitalEligible: true };
  }
  if (!input.probs || !input.market) {
    return { decision: "NO_BET", candidate: false, reason: "missing probs/market", capitalEligible: true };
  }
  const side = input.probs[0]! >= input.probs[1]! && input.probs[0]! >= input.probs[2]! ? 0 : input.probs[1]! >= input.probs[2]! ? 1 : 2;
  const diff = input.probs[side]! - input.market[side]!;
  const candidate = diff >= input.threshold;
  if (!candidate) {
    return { decision: "NO_BET", candidate: false, reason: "EDGE_BELOW_THRESHOLD", capitalEligible: true };
  }
  if (input.trainN < input.minTrain) {
    return { decision: "NO_BET", candidate: true, reason: "INSUFFICIENT_SAMPLE", capitalEligible: true };
  }
  if (!input.calibrationOk) {
    return { decision: "NO_BET", candidate: true, reason: "CALIBRATION_NOT_OK", capitalEligible: true };
  }
  if (!input.liquidityOk) {
    return { decision: "NO_BET", candidate: true, reason: "LIQUIDITY_UNKNOWN", capitalEligible: true };
  }
  return { decision: "BET", candidate: true, reason: "EDGE_CANDIDATE_GATES_PASSED", capitalEligible: true };
}

export function meanBrier(
  rows: { p: [number, number, number]; actual: 0 | 1 | 2 }[],
): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + brier3(r.p, r.actual), 0) / rows.length;
}
