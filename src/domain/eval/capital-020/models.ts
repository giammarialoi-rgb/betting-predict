/**
 * Model layer — predeclared frozen model is frequency.
 * No automatic winner. Holdout must not select.
 */

export type ModelId020 =
  | "market_de_vig"
  | "frequency"
  | "home_advantage"
  | "elo"
  | "form"
  | "goals_model"
  | "poisson"
  | "market_elo"
  | "market_form"
  | "market_elo_form"
  | "full_model";

export const ALL_MODELS_020: readonly ModelId020[] = [
  "market_de_vig",
  "frequency",
  "home_advantage",
  "elo",
  "form",
  "goals_model",
  "poisson",
  "market_elo",
  "market_form",
  "market_elo_form",
  "full_model",
];

export type ModelInput020 = {
  freq: [number, number, number];
  formHome: number;
  formAway: number;
  formSample: number;
  marketHome: number | null;
  eloDiff: number | null;
};

export function runModel020(
  id: ModelId020,
  input: ModelInput020,
): [number, number, number] | null {
  const freq = input.freq;
  if (id === "frequency") return freq;
  if (id === "home_advantage") {
    const h = freq[0]! * 0.85 + 0.15 * 0.46;
    const d = freq[1]! * 0.85 + 0.15 * 0.26;
    const a = freq[2]! * 0.85 + 0.15 * 0.28;
    return norm(h, d, a);
  }
  if (id === "form") {
    if (input.formSample < 3) return freq;
    const hp = input.formHome / (3 * Math.max(1, input.formSample));
    const ap = input.formAway / (3 * Math.max(1, input.formSample));
    return norm(freq[0]! * 0.7 + hp * 0.3, freq[1]!, freq[2]! * 0.7 + ap * 0.3);
  }
  if (id === "elo") {
    if (input.eloDiff == null) return null;
    return freq;
  }
  if (id === "market_de_vig" || id.startsWith("market_")) {
    if (input.marketHome == null) return null;
    return freq;
  }
  if (id === "goals_model" || id === "poisson" || id === "full_model") {
    return freq;
  }
  return freq;
}

function norm(h: number, d: number, a: number): [number, number, number] {
  const s = h + d + a;
  return [h / s, d / s, a / s];
}

export function brier3(p: [number, number, number], actual: 0 | 1 | 2): number {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    const y = i === actual ? 1 : 0;
    s += (p[i]! - y) ** 2;
  }
  return s / 3;
}

export function logLoss3(p: [number, number, number], actual: 0 | 1 | 2): number {
  const eps = 1e-12;
  return -Math.log(Math.max(eps, Math.min(1 - eps, p[actual]!)));
}
