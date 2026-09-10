import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  listCalendarEvents,
  todayCalendarDay,
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
    next_events?: Array<{ calendar_day?: string; sport?: string }>;
  };
  const all = Array.isArray(obs.calendar?.events)
    ? obs.calendar.events
    : Array.isArray(obs.next_events)
      ? obs.next_events
      : [];
  const want = (from ?? date) as string;
  const events = all.filter((e) => {
    const row = e as { calendar_day?: string; sport?: string };
    if (from || to) {
      const d = row.calendar_day ?? "";
      if (from && d < from) return false;
      if (to && d > to) return false;
    } else if (row.calendar_day && row.calendar_day !== want) {
      return false;
    }
    if (sport && sport.toUpperCase() !== "ALL") {
      const s = String(row.sport ?? "").toUpperCase();
      if (sport.toUpperCase() === "FOOTBALL" && s !== "FOOTBALL" && s !== "SOCCER") return false;
    }
    return true;
  });
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
    note: events.length === 0 ? "Neon calendar empty — Brain has not published this date yet" : undefined,
  });
}
