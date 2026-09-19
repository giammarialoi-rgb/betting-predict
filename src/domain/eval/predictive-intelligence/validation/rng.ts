/**
 * Generatore pseudocasuale deterministico per bootstrap e ricampionamenti.
 *
 * NON usare un LCG scritto come `seed = (seed * A + C) & 0x7fffffff`: in
 * JavaScript `seed * A` supera 2^53 e perde precisione PRIMA dell'AND, quindi la
 * sequenza degenera e il ricampionamento non e piu uniforme. L'effetto e
 * subdolo: gli intervalli di confidenza risultano stretti e spostati, e possono
 * non contenere nemmeno la stima puntuale.
 *
 * mulberry32 resta dentro i 32 bit a ogni passo grazie a Math.imul.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bootstrap appaiato sulla differenza per osservazione (a - b). */
export function pairedBootstrap(
  diffs: readonly number[],
  opts?: { iters?: number; seed?: number },
): { mean_diff: number; ci_low: number; ci_high: number; p_first_better: number; n: number } {
  const n = diffs.length;
  if (!n) return { mean_diff: 0, ci_low: 0, ci_high: 0, p_first_better: 0, n: 0 };
  const iters = opts?.iters ?? 3000;
  const rnd = makeRng(opts?.seed ?? 12345);
  const means: number[] = [];
  let better = 0;
  for (let it = 0; it < iters; it += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += diffs[Math.floor(rnd() * n)]!;
    const m = s / n;
    means.push(m);
    if (m < 0) better += 1;
  }
  means.sort((x, y) => x - y);
  return {
    mean_diff: diffs.reduce((a, b) => a + b, 0) / n,
    ci_low: means[Math.floor(0.025 * iters)]!,
    ci_high: means[Math.floor(0.975 * iters)]!,
    p_first_better: better / iters,
    n,
  };
}
