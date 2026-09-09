"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LivePayload = {
  displayedStatus: string;
  collection: { events: number; quotes: number; locked: number; settled: number };
  budget: { remaining: number | null; monthlyLimit: number; safeRemaining: number; used: number | null };
  live043?: {
    catalog: number;
    soccer: number;
    tennis: number;
    predictions: number;
    snapshots: number;
    candidates: number;
    strong: number;
    autopsies: number;
    model_version: string;
  };
};

export default function LiveLabPage() {
  const [data, setData] = useState<LivePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/collector-042/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LivePayload;
        if (alive) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "fetch failed");
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        <Link href="/actuarial-lab">← Actuarial lab</Link> ·{" "}
        <Link href="/actuarial-lab/live-total">Live total 044</Link> ·{" "}
        <Link href="/actuarial-lab/collector">Collector</Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">LIVE TOTAL LAB</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        TASK 043 view · prefer{" "}
        <Link href="/actuarial-lab/live-total" className="underline">
          /actuarial-lab/live-total
        </Link>{" "}
        for TASK 044 permanent cycle · capital closed
      </p>
      {err && <p className="text-red-600">{err}</p>}
      {data && (
        <section className="grid gap-2 text-sm">
          <dl className="grid gap-1">
            <div className="flex justify-between gap-4">
              <dt>COLLECTOR</dt>
              <dd>{data.displayedStatus}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>TODAY / STORE EVENTS</dt>
              <dd>{data.live043?.catalog ?? data.collection.events}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>SOCCER / TENNIS</dt>
              <dd>
                {data.live043?.soccer ?? "—"} / {data.live043?.tennis ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>ANALYZED / PREDICTIONS</dt>
              <dd>{data.live043?.predictions ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>SNAPSHOTS</dt>
              <dd>{data.live043?.snapshots ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>LOCKED / SETTLED</dt>
              <dd>
                {data.collection.locked} / {data.collection.settled}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>CANDIDATES / STRONG</dt>
              <dd>
                {data.live043?.candidates ?? 0} / {data.live043?.strong ?? 0}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>AUTOPSIES</dt>
              <dd>{data.live043?.autopsies ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>MODEL VERSION</dt>
              <dd>{data.live043?.model_version ?? "MODEL_v1"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>CREDITS REM / SAFE</dt>
              <dd>
                {data.budget.remaining ?? "—"} / {data.budget.safeRemaining}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>CAPITAL</dt>
              <dd>CLOSED · BETS=0 · BANKROLL=—</dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
