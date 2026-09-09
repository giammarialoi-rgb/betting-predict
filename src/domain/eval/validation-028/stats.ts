export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function blockBootstrapMeanCI(input: {
  values: readonly number[];
  blockIds: readonly string[];
  nBoot: number;
  seed: number;
  alpha: number;
}): { mean: number; low: number; high: number } | null {
  if (input.values.length === 0) return null;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < input.values.length; i++) {
    const id = input.blockIds[i] ?? `i${i}`;
    const g = groups.get(id) ?? [];
    g.push(input.values[i]!);
    groups.set(id, g);
  }
  const blocks = [...groups.values()];
  const obs = mean(input.values);
  const rand = lcg(input.seed);
  const samples: number[] = [];
  const n = input.values.length;
  for (let b = 0; b < input.nBoot; b++) {
    const acc: number[] = [];
    while (acc.length < n) {
      const blk = blocks[Math.floor(rand() * blocks.length)]!;
      for (const v of blk) {
        acc.push(v);
        if (acc.length >= n) break;
      }
    }
    samples.push(mean(acc.slice(0, n)));
  }
  samples.sort((a, c) => a - c);
  const lo = samples[Math.floor((input.alpha / 2) * samples.length)]!;
  const hi = samples[Math.min(samples.length - 1, Math.floor((1 - input.alpha / 2) * samples.length))]!;
  return { mean: obs, low: lo, high: hi };
}

export function permutationMeanP(input: {
  values: readonly number[];
  nPerm: number;
  seed: number;
}): number | null {
  if (input.values.length === 0) return null;
  const obs = Math.abs(mean(input.values));
  const rand = lcg(input.seed);
  let extreme = 0;
  for (let p = 0; p < input.nPerm; p++) {
    let acc = 0;
    for (const x of input.values) acc += rand() < 0.5 ? x : -x;
    if (Math.abs(acc / input.values.length) >= obs) extreme += 1;
  }
  return (extreme + 1) / (input.nPerm + 1);
}

/** One-sided: H1 mean(values) > 0. Sign-flip permutation. */
export function permutationMeanPOneSidedPositive(input: {
  values: readonly number[];
  nPerm: number;
  seed: number;
}): number | null {
  if (input.values.length === 0) return null;
  const obs = mean(input.values);
  const rand = lcg(input.seed);
  let extreme = 0;
  for (let p = 0; p < input.nPerm; p++) {
    let acc = 0;
    for (const x of input.values) acc += rand() < 0.5 ? x : -x;
    if (acc / input.values.length >= obs) extreme += 1;
  }
  return (extreme + 1) / (input.nPerm + 1);
}

export function pairedDiff(
  a: readonly number[],
  b: readonly number[],
): number[] {
  const n = Math.min(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(a[i]! - b[i]!);
  return out;
}
