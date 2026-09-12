import { NextResponse } from "next/server";
import { listAnalyzedEvents } from "@/domain/eval/light-analysis/list";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await listAnalyzedEvents();
    return NextResponse.json({
      ok: true,
      total: events.length,
      events,
      real_money: false as const,
      note_it:
        events.length === 0
          ? "Nessun analysis_dossier in store o specchio. Esegui pnpm analyze:event. Niente di inventato."
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        total: 0,
        events: [],
        real_money: false as const,
        error: e instanceof Error ? e.message : String(e),
        note_it: "Lettura analizzati fallita. Niente di inventato.",
      },
      { status: 500 },
    );
  }
}
