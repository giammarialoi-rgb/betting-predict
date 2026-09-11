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
          ? "Nessun evento con analisi light o forte persistita. Premi «Aggiorna eventi» per ricalcolare dalle fonti già cablate."
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
