import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { priorMatchesAsOf, featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";

/** League-frequency naive prior as-of (no odds). */
export function predictNaiveLeagueFreq(input: {
  target: PiMatchRow;
  universe: readonly PiMatchRow[];
}): PiProb3 {
  const cut = featureCutoffForMatch(input.target);
  const priors = priorMatchesAsOf(input.universe, cut).filter(
    (m) => m.league === input.target.league,
  );
  const season = priors.filter((m) => m.season === input.target.season);
  const base = season.length >= 30 ? season : priors;
  if (base.length === 0) {
    return normalizeProb3(0.45, 0.27, 0.28);
  }
  let h = 0;
  let d = 0;
  let a = 0;
  for (const m of base) {
    if (m.ftr === "HOME") h += 1;
    else if (m.ftr === "DRAW") d += 1;
    else a += 1;
  }
  return normalizeProb3(h, d, a);
}
