import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, loadModelRegistry044 } from "@/domain/eval/permanent-044/store";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { labAStore044 } from "@/domain/eval/permanent-044/config";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";

export const dynamic = "force-dynamic";

export async function GET() {
  const root = permanentRoot044();
  const labA = labAStore044();
  const store = loadStore044(root);
  const lab = loadStore039(labA);
  const reg = loadModelRegistry044(root);
  const { status } = resolveDisplayedStatus042(labA);
  const credit = loadCreditState042(labA);
  const statusPath = join(root, "collector-status.json");
  const permanentStatus = existsSync(statusPath)
    ? (JSON.parse(readFileSync(statusPath, "utf8")) as { status?: string })
    : { status: "UNKNOWN" };

  const now = Date.now();
  const day = 24 * 3600_000;
  const kickoffs = store.events
    .map((e) => (e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN))
    .filter((t) => Number.isFinite(t));

  return NextResponse.json({
    permanentStatus: permanentStatus.status ?? "UNKNOWN",
    labACollector: status,
    model_version: reg.current_version,
    model_edge: "UNKNOWN",
    capital: "CLOSED",
    real_money: false,
    auto_promotion: false,
    totals: {
      TOTAL_EVENTS: store.events.length,
      ANALYZED_EVENTS: new Set(store.predictions.map((p) => p.event_id)).size,
      SOCCER: store.events.filter((e) => e.sport === "soccer").length,
      TENNIS: store.events.filter((e) => e.sport === "tennis").length,
      LOCKED: store.locks.length,
      SETTLED: store.settlements.length,
      AUTOPSIES: store.autopsies.length,
      LEARNING: store.learning.length,
      PREDICTIONS: store.predictions.length,
      LAB_A_LOCKED: lab.decisions.length,
      LAB_A_SETTLED: lab.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
    },
    windows: {
      TODAY: kickoffs.filter((t) => t >= now && t < now + day).length,
      NEXT_24H: kickoffs.filter((t) => t >= now && t < now + day).length,
      NEXT_3_DAYS: kickoffs.filter((t) => t >= now && t < now + 3 * day).length,
    },
    top20: top20Next3Days044(store),
    budget: {
      remaining: remainingCredits042(credit),
      used: credit.observedUsed ?? credit.estimatedUsed,
    },
    recent_autopsies: store.autopsies.slice(-10).reverse(),
  });
}
