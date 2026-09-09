import { NextResponse } from "next/server";
import { buildObservatory055 } from "@/domain/eval/catalog-055/observatory";

export const dynamic = "force-dynamic";

/** READ-ONLY observatory. Zero Odds API from browser. */
export async function GET() {
  return NextResponse.json(await buildObservatory055());
}
