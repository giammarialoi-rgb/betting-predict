import { NextResponse } from "next/server";
import { buildHonestHealth } from "@/domain/eval/betmind-runtime/honest-health";

export const dynamic = "force-dynamic";

/**
 * Single honest health surface. Does not ping Neon.
 * Same payload as GET /api/betmind/health.
 */
export async function GET() {
  const started = Date.now();
  try {
    const health = await buildHonestHealth(started);
    return NextResponse.json({
      ...health,
      latencyMs: health.latency_ms,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        app: "ok",
        db: "unused",
        neon_in_use: false,
        neon_status_it: "NEON NON UTILIZZATO",
        project: "sports-prediction-engine",
        service: "betmind",
        error: error instanceof Error ? error.message : "unknown",
        latencyMs: Date.now() - started,
        real_money: false,
      },
      { status: 503 },
    );
  }
}
