/**
 * ROC-AUC for binary markets (optional metric).
 */

export function rocAuc(
  pairs: ReadonlyArray<{ yTrue: 0 | 1; yPred: number }>,
): number | null {
  if (pairs.length < 2) return null;
  const pos = pairs.filter((p) => p.yTrue === 1);
  const neg = pairs.filter((p) => p.yTrue === 0);
  if (pos.length === 0 || neg.length === 0) return null;

  let correct = 0;
  let ties = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p.yPred > n.yPred) correct += 1;
      else if (p.yPred === n.yPred) ties += 1;
    }
  }
  return (correct + 0.5 * ties) / (pos.length * neg.length);
}
