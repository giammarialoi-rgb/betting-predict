export function bootstrapMeanCI(
  xs: readonly number[],
  nBoot = 1000,
  alpha = 0.05,
  seed = 27,
): { mean: number; low: number; high: number } | null {
  if (xs.length === 0) return null;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const samples: number[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  for (let b = 0; b < nBoot; b++) {
    let acc = 0;
    for (let i = 0; i < xs.length; i++) {
      acc += xs[Math.floor(rand() * xs.length)]!;
    }
    samples.push(acc / xs.length);
  }
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor((alpha / 2) * samples.length)]!;
  const hi = samples[Math.min(samples.length - 1, Math.floor((1 - alpha / 2) * samples.length))]!;
  return { mean, low: lo, high: hi };
}

export function permutationPValue(
  pnl: readonly number[],
  nPerm = 1000,
  seed = 27,
): number | null {
  if (pnl.length === 0) return null;
  const obs = Math.abs(pnl.reduce((s, x) => s + x, 0) / pnl.length);
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  let extreme = 0;
  for (let p = 0; p < nPerm; p++) {
    let acc = 0;
    for (const x of pnl) {
      acc += rand() < 0.5 ? x : -x;
    }
    if (Math.abs(acc / pnl.length) >= obs) extreme += 1;
  }
  return (extreme + 1) / (nPerm + 1);
}

export function sharpeLike(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  if (v <= 0) return null;
  return mean / Math.sqrt(v);
}
