import { NextResponse } from "next/server";
import { invalidateBetMindSnapshotCache } from "@/domain/eval/betmind-runtime/snapshot-cache";
import { refreshTodayEvents } from "@/domain/eval/light-analysis/refresh";
import { todayCalendarDay } from "@/domain/eval/betmind-runtime/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-run attach + analisi light from Neon/disk. Never fakes brain ONLINE. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayCalendarDay();
  const acquire = url.searchParams.get("acquire") !== "0";

  try {
    const report = await refreshTodayEvents({
      date,
      acquire,
      invalidateSnapshot: invalidateBetMindSnapshotCache,
    });
    return NextResponse.json({
      ...report,
      real_money: false as const,
      brain_online_claimed: false as const,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        at: new Date().toISOString(),
        date,
        progress_it: "Errore durante l’aggiornamento. Niente di inventato.",
        events_seen: 0,
        light_ok: 0,
        light_insufficient: 0,
        attach_hits: 0,
        acquisition: {
          attempted: acquire,
          timed_out: false,
          sources_ok: [],
          sources_failed: [],
          note_it: e instanceof Error ? e.message : String(e),
        },
        history: {
          rows: 0,
          cache: "empty",
          from_cache: false,
          note_it: "Storico non caricato.",
        },
        brain_ran: false as const,
        snapshot_invalidated: false,
        errors: [e instanceof Error ? e.message : String(e)],
        event_ids: [],
        real_money: false as const,
        brain_online_claimed: false as const,
      },
      { status: 500 },
    );
  }
}
