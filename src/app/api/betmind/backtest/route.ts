import { NextResponse } from "next/server";
import { loadPhase9Bundle } from "@/domain/eval/phase-9/persist";
import { storageBanner } from "@/domain/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const bundle = loadPhase9Bundle();
  return NextResponse.json({
    at: new Date().toISOString(),
    neon_in_use: false,
    storage: storageBanner(),
    ...bundle,
  });
}
