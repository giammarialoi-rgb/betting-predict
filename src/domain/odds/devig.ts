/**
 * DEVIG — rimozione del margine del bookmaker.
 *
 * Il metodo proporzionale (p_i = pi_i / somma) e quello che il repo usava, ed e
 * sbagliato in modo sistematico: assume che il book carichi il margine in
 * proporzione alla probabilita, mentre in realta lo carica di piu sugli esiti
 * poco probabili. Risultato: il proporzionale SOTTOSTIMA la probabilita equa dei
 * favoriti e SOVRASTIMA quella degli sfavoriti, e ogni "edge" misurato su un
 * outsider ne e in parte un artefatto.
 *
 * Shin (1993) modella il margine come difesa del book contro scommettitori
 * informati, con una quota z di denaro informato. Il metodo power assume invece
 * p_i proporzionale a pi_i^(1/k). Entrambi tolgono piu margine dalle quote lunghe
 * che dalle corte, che e cio che si osserva nei dati.
 */

export type DevigMethod = "proportional" | "shin" | "power";

export type DevigResult = {
  probabilities: number[];
  method: DevigMethod;
  overround: number;
  /** Shin: quota stimata di denaro informato. Power: esponente k. */
  parameter: number | null;
  converged: boolean;
};

function impliedFromOdds(odds: readonly number[]): number[] {
  for (const o of odds) {
    if (!Number.isFinite(o) || o <= 1) throw new RangeError(`quota decimale non valida: ${o}`);
  }
  return odds.map((o) => 1 / o);
}

/** p_i = pi_i / somma. Conservato per confronto, non da usare in produzione. */
export function devigProportional(odds: readonly number[]): DevigResult {
  const pi = impliedFromOdds(odds);
  const s = pi.reduce((a, b) => a + b, 0);
  return {
    probabilities: pi.map((p) => p / s),
    method: "proportional",
    overround: s,
    parameter: null,
    converged: true,
  };
}

/**
 * Shin. Dato il booksum B e le implicite grezze pi_i, si cerca z tale che le
 *
 *   p_i = [ sqrt( z^2 + 4(1-z) * pi_i^2 / B ) - z ] / ( 2(1-z) )
 *
 * sommino a 1. La somma e monotona decrescente in z, quindi bisezione.
 */
export function devigShin(odds: readonly number[], maxIter = 80): DevigResult {
  const pi = impliedFromOdds(odds);
  const B = pi.reduce((a, b) => a + b, 0);
  if (B <= 1) return { ...devigProportional(odds), method: "shin", parameter: 0 };

  const sumFor = (z: number): number => {
    if (z <= 0) return B;
    const denom = 2 * (1 - z);
    if (denom <= 0) return 0;
    let s = 0;
    for (const p of pi) s += (Math.sqrt(z * z + (4 * (1 - z) * p * p) / B) - z) / denom;
    return s;
  };

  let lo = 0;
  let hi = 0.5;
  if (sumFor(hi) > 1) {
    return { ...devigProportional(odds), method: "shin", parameter: null, converged: false };
  }
  let z = 0;
  let converged = false;
  for (let i = 0; i < maxIter; i += 1) {
    z = (lo + hi) / 2;
    const s = sumFor(z);
    if (Math.abs(s - 1) < 1e-12) {
      converged = true;
      break;
    }
    if (s > 1) lo = z;
    else hi = z;
    converged = hi - lo < 1e-12;
  }
  const denom = 2 * (1 - z);
  const raw = pi.map((p) => (Math.sqrt(z * z + (4 * (1 - z) * p * p) / B) - z) / denom);
  const s = raw.reduce((a, b) => a + b, 0);
  return {
    probabilities: raw.map((p) => p / s),
    method: "shin",
    overround: B,
    parameter: z,
    converged,
  };
}

/**
 * Power: p_i = pi_i^k, con k>1 cercato per bisezione.
 *
 * L'esponente va SOPRA 1, non sotto. Poiche le implicite sono minori di 1,
 * elevarle a k>1 le riduce tutte, ma in proporzione molto maggiore quelle
 * piccole: 0,83^1,11 perde il 2%, 0,067^1,11 ne perde il 16%. E' esattamente la
 * forma del margine reale. Con l'esponente 1/k si otteneva l'effetto opposto.
 */
export function devigPower(odds: readonly number[], maxIter = 80): DevigResult {
  const pi = impliedFromOdds(odds);
  const B = pi.reduce((a, b) => a + b, 0);
  if (B <= 1) return { ...devigProportional(odds), method: "power", parameter: 1 };

  const sumFor = (k: number): number => pi.reduce((a, p) => a + Math.pow(p, k), 0);
  let lo = 1;
  let hi = 2;
  while (sumFor(hi) > 1 && hi < 64) hi *= 2;
  let k = 1;
  let converged = false;
  for (let i = 0; i < maxIter; i += 1) {
    k = (lo + hi) / 2;
    const s = sumFor(k);
    if (Math.abs(s - 1) < 1e-12) {
      converged = true;
      break;
    }
    if (s > 1) lo = k;
    else hi = k;
    converged = hi - lo < 1e-12;
  }
  const raw = pi.map((p) => Math.pow(p, k));
  const s = raw.reduce((a, b) => a + b, 0);
  return {
    probabilities: raw.map((p) => p / s),
    method: "power",
    overround: B,
    parameter: k,
    converged,
  };
}

export function devig(odds: readonly number[], method: DevigMethod = "shin"): DevigResult {
  if (method === "proportional") return devigProportional(odds);
  if (method === "power") return devigPower(odds);
  return devigShin(odds);
}

/** Quota equa (senza margine) per ciascun esito. */
export function fairOdds(odds: readonly number[], method: DevigMethod = "shin"): number[] {
  return devig(odds, method).probabilities.map((p) => 1 / Math.max(1e-12, p));
}
