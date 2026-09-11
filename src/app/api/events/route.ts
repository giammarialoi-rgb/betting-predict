import { NextResponse } from "next/server";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  listCalendarEvents,
  todayCalendarDay,
} from "@/domain/eval/betmind-runtime/calendar";
import {
  loadBoardEventsFromNeon,
  loadRuntimeStatus,
} from "@/domain/eval/betmind-runtime/remote-status";
import {
  collectNeonUniverse,
  filterNeonUniverse,
  localLabStorePresent,
  neonEventsEmptyReason,
} from "@/domain/eval/betmind-runtime/production-mirror";

export const dynamic = "force-dynamic";

/** All discovered events for a date. No 8/25/120/150 list cap. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayCalendarDay();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const sport = url.searchParams.get("sport") ?? "ALL";
  const query = {
    date: from || to ? null : date,
    from,
    to,
    sport,
  };
  const root = permanentRoot044();

  if (localLabStorePresent(root)) {
    const cal = listCalendarEvents({
      root,
      date: from || to ? null : date,
      from,
      to,
      sport,
    });
    return NextResponse.json({
      ok: true,
      source: "disk",
      date: cal.day ?? date,
      from: from ?? date,
      to: to ?? date,
      sport,
      total: cal.total,
      cap: false,
      events: cal.events,
      real_money: false,
      note:
        cal.total === 0
          ? neonEventsEmptyReason({
              remotePresent: true,
              remoteFresh: true,
              universeCount: 0,
              filteredCount: 0,
              date,
              sport,
              storePresentLocalOnPublisher: true,
            })
          : undefined,
    });
  }

  const board = await loadBoardEventsFromNeon(query);
  if (board && board.total > 0) {
    return NextResponse.json({
      ok: true,
      source: "filesystem_board",
      date,
      from: from ?? date,
      to: to ?? date,
      sport,
      total: board.total,
      cap: false,
      events: board.events,
      real_money: false,
    });
  }

  const remote = await loadRuntimeStatus();
  const obs = (remote?.payload?.observatory ?? {}) as {
    calendar?: { date?: string; day?: string; events?: unknown[]; total?: number };
    next_events?: unknown[];
  };
  const universe = collectNeonUniverse(obs);
  const events = filterNeonUniverse(universe, query);
  const note = neonEventsEmptyReason({
    remotePresent: Boolean(remote),
    remoteFresh: remote ? remote.fresh : null,
    universeCount: universe.length,
    filteredCount: events.length,
    date,
    sport,
    storePresentLocalOnPublisher: remote?.payload.store_present_local ?? null,
  });
  return NextResponse.json({
    ok: true,
    source: remote ? "neon" : "none",
    date,
    from: from ?? date,
    to: to ?? date,
    sport,
    total: events.length,
    cap: false,
    events,
    real_money: false,
    mirror_stale: remote ? !remote.fresh : undefined,
    mirror_published_at: remote?.published_at,
    note: note || undefined,
  });
}
