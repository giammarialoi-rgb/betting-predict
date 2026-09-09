"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusPayload = {
  displayedStatus: string;
  stale: boolean;
  lockAlive: boolean;
  heartbeat: {
    lastPullAt: string | null;
    nextPullAt: string | null;
    lastError: string | null;
    pausedReason: string | null;
    backoffMs: number;
    mode: string;
    providerStatus: string;
    remainingTo100: number;
    settledEvents: number;
    apiKeyConfigured: boolean;
  };
  budget: {
    monthlyLimit: number;
    used: number | null;
    remaining: number | null;
    estimatedRemaining: number | null;
    observedRemaining: number | null;
    safeRemaining: number;
    maxCreditsPerRun: number;
    sourceOfTruth: string;
    lastUpdatedAt: string;
    resetAt: string;
    requests: number;
  };
  collection: { events: number; quotes: number; locked: number; settled: number };
  nextKickoffs: {
    event_id: string;
    home_team: string;
    away_team: string;
    kickoff: string;
    ms_to_kickoff: number;
    state: string;
  }[];
  pipeline: Record<string, string>;
};

function bar(settled: number, target = 100): string {
  const pct = Math.max(0, Math.min(100, Math.round((settled / target) * 100)));
  const filled = Math.round(pct / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} ${pct}%`;
}

function fmtEta(ms: number): string {
  if (ms < 0) return "past";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function CollectorMonitorPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/collector-042/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatusPayload;
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
        <Link href="/actuarial-lab">← Actuarial lab</Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">LIVE COLLECTOR</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        TASK 042 · reads persisted heartbeat/budget only · no browser API calls to The Odds API
      </p>

      {err && <p className="text-red-600">Error: {err}</p>}
      {!data && !err && <p className="text-zinc-500">Loading status…</p>}

      {data && (
        <>
          <section className="grid gap-2 text-sm">
            <h2 className="text-lg font-medium">STATUS</h2>
            <p className="text-2xl font-semibold">{data.displayedStatus}</p>
            <dl className="grid gap-1">
              <div className="flex justify-between gap-4">
                <dt>LOCK ALIVE</dt>
                <dd>{data.lockAlive ? "yes" : "no"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>STALE HEARTBEAT</dt>
                <dd>{data.stale ? "yes" : "no"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>MODE</dt>
                <dd>{data.heartbeat.mode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>LAST PULL</dt>
                <dd>{data.heartbeat.lastPullAt ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>NEXT PULL</dt>
                <dd>{data.heartbeat.nextPullAt ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>API</dt>
                <dd>
                  {data.heartbeat.apiKeyConfigured ? "CONNECTED" : "MISSING KEY"} / {data.heartbeat.providerStatus}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>LAST ERROR</dt>
                <dd className="max-w-md truncate text-right">{data.heartbeat.lastError ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>PAUSED REASON</dt>
                <dd>{data.heartbeat.pausedReason ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>BACKOFF</dt>
                <dd>{data.heartbeat.backoffMs} ms</dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-2 text-sm">
            <h2 className="text-lg font-medium">BUDGET</h2>
            <dl className="grid gap-1">
              <div className="flex justify-between gap-4">
                <dt>MONTHLY LIMIT</dt>
                <dd>{data.budget.monthlyLimit}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>USED</dt>
                <dd>{data.budget.used ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>REMAINING</dt>
                <dd>{data.budget.remaining ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>ESTIMATED REMAINING</dt>
                <dd>{data.budget.estimatedRemaining ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>SAFE REMAINING</dt>
                <dd>{data.budget.safeRemaining}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>MAX / RUN</dt>
                <dd>{data.budget.maxCreditsPerRun}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>SOURCE OF TRUTH</dt>
                <dd>{data.budget.sourceOfTruth}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>REQUESTS (local)</dt>
                <dd>{data.budget.requests}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>LAST UPDATE / RESET</dt>
                <dd>
                  {data.budget.lastUpdatedAt} / {data.budget.resetAt}
                </dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-2 text-sm">
            <h2 className="text-lg font-medium">COLLECTION</h2>
            <dl className="grid gap-1">
              <div className="flex justify-between gap-4">
                <dt>EVENTS</dt>
                <dd>{data.collection.events}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>QUOTES</dt>
                <dd>{data.collection.quotes}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>LOCKED</dt>
                <dd>{data.collection.locked}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>SETTLED</dt>
                <dd>{data.collection.settled}</dd>
              </div>
            </dl>
            <p className="font-mono text-base">
              PROGRESS {data.collection.settled} / 100
              <br />
              {bar(data.collection.settled)}
            </p>
          </section>

          <section className="grid gap-2 text-sm">
            <h2 className="text-lg font-medium">PIPELINE</h2>
            <dl className="grid gap-1">
              {Object.entries(data.pipeline).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="uppercase">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="grid gap-2 text-sm">
            <h2 className="text-lg font-medium">NEXT KICKOFFS</h2>
            <ul className="grid gap-2">
              {data.nextKickoffs.map((k) => (
                <li key={k.event_id} className="flex flex-col border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span>
                    {k.home_team} vs {k.away_team}
                  </span>
                  <span className="text-zinc-500">
                    {k.kickoff} · {fmtEta(k.ms_to_kickoff)} · {k.state}
                  </span>
                </li>
              ))}
              {data.nextKickoffs.length === 0 && <li className="text-zinc-500">No events</li>}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
