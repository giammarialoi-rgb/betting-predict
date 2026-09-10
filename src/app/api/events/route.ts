import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  listCalendarEvents,
  todayCalendarDay,
  matchesCalendarQuery,
} from "@/domain/eval/betmind-runtime/calendar";
import { loadRuntimeStatus } from "@/domain/eval/betmind-runtime/remote-status";

export const dynamic = "force-dynamic";

/** All discovered events for a date. No 8/25/120/150 list cap. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayCalendarDay();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const sport = url.searchParams.get("sport") ?? "football";
  const root = permanentRoot044();
  const storePresent = existsSync(root);

  if (storePresent) {
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
    });
  }

  const remote = await loadRuntimeStatus();
  const obs = (remote.payload?.observatory ?? {}) as {
    calendar?: { date?: string; day?: string; events?: unknown[]; total?: number };
    next_events?: unknown[];
  };
  const universe = Array.isArray(obs.next_events)
    ? obs.next_events
    : Array.isArray(obs.calendar?.events)
      ? obs.calendar.events
      : [];
  const events = universe.filter((e) =>
    matchesCalendarQuery(e as { calendar_day?: string; kickoff_utc?: string; sport?: string }, {
      date: from || to ? null : date,
      from,
      to,
      sport,
    }),
  );
  return NextResponse.json({
    ok: true,
    source: "neon",
    date,
    from: from ?? date,
    to: to ?? date,
    sport,
    total: events.length,
    cap: false,
    events,
    real_money: false,
    note: events.length === 0 ? "Neon calendar empty - Brain has not published this date yet" : undefined,
  });
}
