import { NextResponse } from "next/server";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { readActivityFeed055, loadCurrentActivity055, loadCoverage055 } from "@/domain/eval/catalog-055/cycle";

export const dynamic = "force-dynamic";

/** Disk-only activity feed. Zero Odds API from browser. */
export async function GET() {
  const root = permanentRoot044();
  return NextResponse.json({
    api_calls_ui: 0 as const,
    current_activity: loadCurrentActivity055(root),
    coverage_at: loadCoverage055(root)?.at ?? null,
    feed: readActivityFeed055(root, 120),
  });
}
