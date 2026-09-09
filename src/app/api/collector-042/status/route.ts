import { NextResponse } from "next/server";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { sourceStore042 } from "@/domain/eval/collector-042/config";
import { nextKickoffs042 } from "@/domain/eval/collector-042/cycle";
import { isLockHeldByAliveProcess042 } from "@/domain/eval/collector-042/lock";
import { loadStore043, loadModelRegistry043 } from "@/domain/eval/live-043/store";
import { artifactStore043 } from "@/domain/eval/live-043/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const root = sourceStore042();
  const { status, heartbeat, stale } = resolveDisplayedStatus042(root);
  const credit = loadCreditState042(root);
  const store = loadStore039(root);
  const live = loadStore043(artifactStore043());
  const reg = loadModelRegistry043(artifactStore043());
  return NextResponse.json({
    displayedStatus: status,
    stale,
    lockAlive: isLockHeldByAliveProcess042(root),
    heartbeat,
    budget: {
      monthlyLimit: credit.monthlyLimit,
      used: credit.observedUsed ?? credit.estimatedUsed,
      remaining: remainingCredits042(credit),
      estimatedRemaining: credit.estimatedRemaining,
      observedRemaining: credit.observedRemaining,
      safeRemaining: credit.safeRemaining,
      maxCreditsPerRun: credit.maxCreditsPerRun,
      sourceOfTruth: credit.sourceOfTruth,
      lastUpdatedAt: credit.lastUpdatedAt,
      resetAt: credit.resetAt,
      requests: credit.requests,
      estimatedCredits: credit.estimatedCredits,
    },
    collection: {
      events: store.events.length,
      quotes: store.quotes.length,
      locked: store.decisions.length,
      settled: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
    },
    live043: {
      catalog: live.catalog.length,
      soccer: live.catalog.filter((c) => c.sport === "soccer").length,
      tennis: live.catalog.filter((c) => c.sport === "tennis").length,
      predictions: live.predictions.length,
      snapshots: live.snapshots.length,
      candidates: live.predictions.filter((p) => p.candidate_class === "CANDIDATE").length,
      strong: live.predictions.filter((p) => p.candidate_class === "STRONG_CANDIDATE").length,
      autopsies: live.autopsies.length,
      model_version: reg.current_version,
    },
    nextKickoffs: nextKickoffs042(store, 10),
    pipeline: {
      collect: store.quotes.length > 0 ? "OK" : "PENDING",
      lock: store.decisions.length > 0 ? "OK" : "PENDING",
      reveal: store.settlements.length > 0 ? "ACTIVE" : "WAITING_KICKOFF",
      settle: store.settlements.some((s) => s.outcome !== "UNSETTLED") ? "ACTIVE" : "WAITING",
      lab: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length >= 100 ? "READY" : "BLOCKED_UNTIL_100",
      total_live: live.predictions.length > 0 ? "OK" : "PENDING_ONCE",
    },
  });
}
