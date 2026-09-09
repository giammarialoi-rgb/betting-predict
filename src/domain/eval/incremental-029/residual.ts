export function softmax(z: number[]): [number, number, number] {
  const m = Math.max(z[0]!, z[1]!, z[2]!);
  const e0 = Math.exp(z[0]! - m);
  const e1 = Math.exp(z[1]! - m);
  const e2 = Math.exp(z[2]! - m);
  const s = e0 + e1 + e2;
  return [e0 / s, e1 / s, e2 / s];
}

export type ResidualWeights = number[][];

export function residualPredict(
  market: [number, number, number],
  x: readonly number[],
  W: ResidualWeights | null,
): [number, number, number] {
  if (!W || W[0]?.length === 0 || x.length === 0) return market;
  const z = [0, 1, 2].map((k) => {
    let acc = Math.log(Math.max(1e-12, market[k]!));
    const row = W[k]!;
    for (let j = 0; j < x.length; j++) acc += (row[j] ?? 0) * (x[j] ?? 0);
    return acc;
  });
  return softmax(z);
}

export function fitResidual(input: {
  markets: [number, number, number][];
  X: number[][];
  y: (0 | 1 | 2)[];
  iters: number;
  lr: number;
  seed: number;
}): ResidualWeights {
  const d = input.X[0]?.length ?? 0;
  let s = input.seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const W: ResidualWeights = [
    Array.from({ length: d }, () => (rand() - 0.5) * 0.01),
    Array.from({ length: d }, () => (rand() - 0.5) * 0.01),
    Array.from({ length: d }, () => (rand() - 0.5) * 0.01),
  ];
  const n = input.X.length;
  if (n === 0 || d === 0) return W;
  for (let it = 0; it < input.iters; it++) {
    const g = [Array(d).fill(0), Array(d).fill(0), Array(d).fill(0)] as number[][];
    for (let i = 0; i < n; i++) {
      const p = residualPredict(input.markets[i]!, input.X[i]!, W);
      const y = input.y[i]!;
      const x = input.X[i]!;
      for (let k = 0; k < 3; k++) {
        const err = p[k]! - (k === y ? 1 : 0);
        for (let j = 0; j < d; j++) g[k]![j] += err * (x[j] ?? 0);
      }
    }
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < d; j++) W[k]![j] -= (input.lr * g[k]![j]!) / n;
    }
  }
  return W;
}
