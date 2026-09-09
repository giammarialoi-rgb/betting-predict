import { NextResponse } from "next/server";
import { pingDatabase } from "@/db/ping";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  try {
    await pingDatabase();
    return NextResponse.json({
      ok: true,
      app: "ok",
      db: "ok",
      project: "sports-prediction-engine",
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        app: "ok",
        db: "error",
        project: "sports-prediction-engine",
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 503 },
    );
  }
}
