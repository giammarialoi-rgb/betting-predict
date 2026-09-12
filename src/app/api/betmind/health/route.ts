import { NextResponse } from "next/server";
import { buildHonestHealth } from "@/domain/eval/betmind-runtime/honest-health";

export const dynamic = "force-dynamic";

/**
 * Same builder as GET /api/health. Disk first; Blob when Lab B FS absent.
 * Zero Odds API / API-Sports / Neon calls.
 */
export async function GET() {
  const started = Date.now();
  try {
    const health = await buildHonestHealth(started);
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "betmind",
        app: "ok",
        neon_in_use: false,
        neon_status_it: "NEON NON UTILIZZATO",
        db: "unused",
        at: new Date().toISOString(),
        latency_ms: Date.now() - started,
        real_money: false as const,
        api_calls: 0 as const,
        components: {
          supervisor: "UNKNOWN",
          worker: "UNKNOWN",
          brain: "UNKNOWN",
          predictive_engine: "OFFLINE",
          data_pipeline: "OFFLINE",
          settlement: "UNKNOWN",
          learning: "UNKNOWN",
        },
        detail: {
          error: error instanceof Error ? error.message : "unknown",
        },
      },
      { status: 200 },
    );
  }
}
