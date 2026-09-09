/**
 * Multiple-testing / data-snooping protection foundation.
 * Prevents declaring "we beat the bookmaker" from one lucky cell among thousands.
 */

export type HypothesisTestRecord = {
  id: string;
  marketId: string;
  family: string;
  pValue: number | null;
  status: "DECLARED" | "CONFIRMED_OOS" | "REJECTED" | "PENDING";
};

export function bonferroniThreshold(
  alpha: number,
  numberOfTests: number,
): number {
  if (numberOfTests <= 0) throw new RangeError("numberOfTests must be > 0");
  return alpha / numberOfTests;
}

export function survivesBonferroni(input: {
  pValue: number;
  alpha: number;
  numberOfTests: number;
}): boolean {
  return input.pValue < bonferroniThreshold(input.alpha, input.numberOfTests);
}

/**
 * Require out-of-sample confirmation before claiming edge.
 */
export function assertClaimRequiresOos(input: {
  inSampleSignificant: boolean;
  outOfSampleConfirmed: boolean;
  claim: string;
}): void {
  if (input.inSampleSignificant && !input.outOfSampleConfirmed) {
    throw new Error(
      `DATA_SNOOPING_GUARD: cannot claim "${input.claim}" without out-of-sample confirmation`,
    );
  }
}

export function countActiveHypotheses(
  records: readonly HypothesisTestRecord[],
): number {
  return records.filter((r) => r.status !== "REJECTED").length;
}

/**
 * Benjamini–Hochberg FDR control.
 * Documented method: sort p-values ascending; reject H_i if
 * p_(i) <= (i/m) * alpha. Returns indices (into original array) that survive.
 */
export function benjaminiHochberg(
  pValues: readonly number[],
  alpha: number,
): { rejectedIndices: number[]; method: "benjamini_hochberg" } {
  if (alpha <= 0 || alpha >= 1) {
    throw new RangeError("alpha must be in (0,1)");
  }
  const m = pValues.length;
  if (m === 0) return { rejectedIndices: [], method: "benjamini_hochberg" };

  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  let maxK = -1;
  for (let k = 0; k < m; k++) {
    const rank = k + 1;
    if (indexed[k]!.p <= (rank / m) * alpha) {
      maxK = k;
    }
  }
  const rejectedIndices =
    maxK < 0 ? [] : indexed.slice(0, maxK + 1).map((x) => x.i);
  return { rejectedIndices, method: "benjamini_hochberg" };
}

/**
 * Holm–Bonferroni (step-down). Adjusted p is monotone: max of p_(k)*(m-k+1) along the prefix.
 */
export function holmBonferroni(
  pValues: readonly number[],
  alpha = 0.05,
): {
  adjusted: number[];
  rejected: boolean[];
  method: "holm_bonferroni";
} {
  const m = pValues.length;
  const adjusted = Array.from({ length: m }, () => 1);
  const rejected = Array.from({ length: m }, () => false);
  if (m === 0) return { adjusted, rejected, method: "holm_bonferroni" };
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);
  let running = 0;
  for (let k = 0; k < m; k++) {
    const adj = Math.min(1, indexed[k]!.p * (m - k));
    running = Math.max(running, adj);
    adjusted[indexed[k]!.i] = running;
  }
  let still = true;
  for (let k = 0; k < m; k++) {
    const thr = alpha / (m - k);
    if (still && indexed[k]!.p <= thr) {
      rejected[indexed[k]!.i] = true;
    } else {
      still = false;
    }
  }
  return { adjusted, rejected, method: "holm_bonferroni" };
}

export type MultipleTestingSummary = {
  numberOfHypothesesTested: number;
  numberOfSignificantResults: number;
  correctionMethod: "bonferroni" | "benjamini_hochberg";
  alpha: number;
  effectSizes: number[];
  confidenceIntervals: Array<{ low: number; high: number } | null>;
  statisticalSignificanceCount: number;
  /** Economic significance requires separate validated criteria — not auto-inferred. */
  economicSignificanceCount: number;
};

export function summarizeMultipleTesting(input: {
  pValues: readonly number[];
  alpha: number;
  method: "bonferroni" | "benjamini_hochberg";
  effectSizes?: readonly number[];
  confidenceIntervals?: Array<{ low: number; high: number } | null>;
}): MultipleTestingSummary {
  let significant = 0;
  if (input.method === "bonferroni") {
    const thr = bonferroniThreshold(input.alpha, Math.max(1, input.pValues.length));
    significant = input.pValues.filter((p) => p < thr).length;
  } else {
    significant = benjaminiHochberg(input.pValues, input.alpha).rejectedIndices
      .length;
  }
  return {
    numberOfHypothesesTested: input.pValues.length,
    numberOfSignificantResults: significant,
    correctionMethod: input.method,
    alpha: input.alpha,
    effectSizes: [...(input.effectSizes ?? [])],
    confidenceIntervals: [...(input.confidenceIntervals ?? [])],
    statisticalSignificanceCount: significant,
    economicSignificanceCount: 0,
  };
}
