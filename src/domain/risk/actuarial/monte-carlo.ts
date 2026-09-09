/**
 * Monte Carlo ruin diagnostics — AFTER policy freeze.
 * Must never retune historical stakes.
 */

export type MonteCarloResult = {
  kind: "SIMULATED";
  n_paths: number;
  seed: number;
  ruin_probability: number;
  median_terminal: number;
  p05_terminal: number;
  p95_terminal: number;
  median_max_drawdown: number;
  note: string;
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap historical per-decision returns into paths (diagnostic only).
 */
export function runMonteCarloDiagnostic(input: {
  initialBankroll: number;
  decisionReturns: number[];
  nPaths: number;
  seed: number;
  stepsPerPath: number;
  ruinFloorFraction?: number;
}): MonteCarloResult {
  const rnd = mulberry32(input.seed);
  const rets = input.decisionReturns;
  const floor = input.initialBankroll * (input.ruinFloorFraction ?? 0.05);
  if (rets.length === 0) {
    return {
      kind: "SIMULATED",
      n_paths: input.nPaths,
      seed: input.seed,
      ruin_probability: 0,
      median_terminal: input.initialBankroll,
      p05_terminal: input.initialBankroll,
      p95_terminal: input.initialBankroll,
      median_max_drawdown: 0,
      note: "No historical returns — MC skipped meaningfully.",
    };
  }

  const terminals: number[] = [];
  const maxDds: number[] = [];
  let ruins = 0;

  for (let p = 0; p < input.nPaths; p++) {
    let b = input.initialBankroll;
    let peak = b;
    let maxDd = 0;
    let ruined = false;
    for (let s = 0; s < input.stepsPerPath; s++) {
      const r = rets[Math.floor(rnd() * rets.length)]!;
      b = Math.max(0, b * (1 + r));
      peak = Math.max(peak, b);
      maxDd = Math.max(maxDd, peak > 0 ? (peak - b) / peak : 0);
      if (b <= floor) {
        ruined = true;
        break;
      }
    }
    if (ruined) ruins += 1;
    terminals.push(b);
    maxDds.push(maxDd);
  }

  terminals.sort((a, b) => a - b);
  maxDds.sort((a, b) => a - b);
  const q = (arr: number[], p: number) =>
    arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]!;

  return {
    kind: "SIMULATED",
    n_paths: input.nPaths,
    seed: input.seed,
    ruin_probability: ruins / input.nPaths,
    median_terminal: q(terminals, 0.5),
    p05_terminal: q(terminals, 0.05),
    p95_terminal: q(terminals, 0.95),
    median_max_drawdown: q(maxDds, 0.5),
    note: "SIMULATED bootstrap — separate from HISTORICAL OBSERVED. Must not retune policy.",
  };
}
