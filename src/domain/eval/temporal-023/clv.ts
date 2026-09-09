import { closingLineValueDelta } from "@/domain/odds/baseline";
import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";

export function computeClvAfterLock(input: {
  locked: boolean;
  entryPrice: number;
  closingPrice: number;
}): ReturnType<typeof closingLineValueDelta> {
  if (!input.locked) {
    throw new BlindLeakageError("C: closing_price used before LOCK");
  }
  return closingLineValueDelta({
    betOdds: input.entryPrice,
    closingOdds: input.closingPrice,
  });
}

export function lastPrematchClose(ticks: readonly { phase: string; publishTimeMs: number; lastPriceTraded: number; selectionId: number }[], selectionId: number): {
  price: number;
  timestampMs: number;
} | null {
  let best: { price: number; timestampMs: number } | null = null;
  for (const t of ticks) {
    if (t.selectionId !== selectionId) continue;
    if (t.phase !== "PREMATCH") continue;
    if (!best || t.publishTimeMs > best.timestampMs) {
      best = { price: t.lastPriceTraded, timestampMs: t.publishTimeMs };
    }
  }
  return best;
}
