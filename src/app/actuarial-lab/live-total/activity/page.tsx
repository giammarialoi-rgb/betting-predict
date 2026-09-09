"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FeedItem = { at: string; kind: string; summary: string };
type Payload = {
  api_calls_ui: 0;
  current_activity: {
    phase: string;
    source: string;
    sport: string | null;
    events_processed: number;
    events_remaining: number;
    note: string;
  } | null;
  feed: FeedItem[];
};

export default function LiveActivityPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/permanent-live/activity", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Payload;
        if (alive) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mb-2 text-sm">
        <Link href="/actuarial-lab/live-total" className="underline">
          ← Control Center
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Live activity</h1>
      <p className="mb-6 text-sm text-zinc-500">Local polling · zero Odds API from browser</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {data?.current_activity && (
        <section className="mb-6 text-sm">
          <h2 className="mb-1 font-medium">Current activity</h2>
          <p>
            {data.current_activity.phase} · {data.current_activity.source}
            {data.current_activity.sport ? ` · ${data.current_activity.sport}` : ""} · processed{" "}
            {data.current_activity.events_processed} · remaining {data.current_activity.events_remaining}
          </p>
          <p className="text-xs text-zinc-500">{data.current_activity.note}</p>
        </section>
      )}
      <ul className="space-y-1 font-mono text-xs">
        {(data?.feed ?? []).map((a, idx) => (
          <li key={`${a.at}-${idx}`}>
            [{a.at.slice(11, 19)}] {a.kind} — {a.summary}
          </li>
        ))}
        {data && !data.feed.length && <li className="text-zinc-500">No activity yet — run brain or permanent-live:multisource:once</li>}
      </ul>
    </main>
  );
}
