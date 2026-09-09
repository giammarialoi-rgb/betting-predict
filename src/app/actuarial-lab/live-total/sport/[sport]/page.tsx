"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { reactListKey052 } from "@/domain/eval/ui-052/keys";

type Center = {
  next_events: {
    event_id: string;
    kickoff_utc: string | null;
    sport: string;
    competition: string;
    label: string;
    minutes_to_kickoff: number | null;
    status: string;
    prediction_status: string;
    lock_status: string;
    selection: string | null;
    confidence: number | null;
    markets: string[];
  }[];
  massive_053?: {
    sport_diagnostics: { sport: string; status: string; note: string | null; unique_events: number }[];
  };
};

export default function SportLivePage() {
  const params = useParams<{ sport: string }>();
  const sport = (params.sport || "").toLowerCase();
  const [data, setData] = useState<Center | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/permanent-live/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) {
          setData(j as Center);
          setErr(null);
        }
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "fetch failed"));
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.next_events.filter((e) => {
      const s = (e.sport || "").toLowerCase();
      if (sport === "hockey") return s.includes("hockey");
      if (sport === "other") {
        return !["soccer", "tennis", "basket", "volley", "hockey"].some((f) => s.includes(f));
      }
      return s.includes(sport) || (sport === "soccer" && s.includes("football"));
    });
  }, [data, sport]);

  const diag = data?.massive_053?.sport_diagnostics.find((s) => s.sport.toLowerCase() === sport);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        <Link href="/actuarial-lab/live-total">← Live Total</Link>
      </p>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{sport.toUpperCase()}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Status {diag?.status ?? "—"} · events {diag?.unique_events ?? rows.length}
          {diag?.note ? ` · ${diag.note}` : ""}
        </p>
      </header>
      {err && <p className="text-red-600">{err}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-2">Kickoff</th>
              <th className="py-2 pr-2">Event</th>
              <th className="py-2 pr-2">League</th>
              <th className="py-2 pr-2">Pred</th>
              <th className="py-2 pr-2">Lock</th>
              <th className="py-2">Markets</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, idx) => (
              <tr key={reactListKey052({ event_id: e.event_id, kickoff_utc: e.kickoff_utc }, idx, "sp")} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 whitespace-nowrap">{e.kickoff_utc?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                <td className="py-2 pr-2">
                  <Link className="underline" href={`/actuarial-lab/live-total/event/${e.event_id}`}>
                    {e.label}
                  </Link>
                </td>
                <td className="py-2 pr-2">{e.competition}</td>
                <td className="py-2 pr-2">
                  {e.prediction_status}
                  {e.selection ? ` · ${e.selection}` : ""}
                </td>
                <td className="py-2 pr-2">{e.lock_status}</td>
                <td className="py-2">{e.markets.join(", ") || "—"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">
                  No events in next_events for this sport — see STATUS above (ACTIVE_EMPTY / UNAVAILABLE / BUDGET_BLOCKED).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
