"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Health = {
  api_calls_ui: 0;
  status: string;
  system: {
    status: string;
    worker_pid: number | null;
    worker_alive: boolean;
    supervisor_pid?: number | null;
    supervisor_alive?: boolean;
    official_status?: string;
    heartbeat_at: string | null;
    heartbeat_age_ms: number | null;
    last_cycle_at: string | null;
    restart_count: number;
    consecutive_errors: number;
    last_restart_reason?: string | null;
    phase?: string | null;
    sport?: string | null;
    budget_state?: string | null;
    api_state?: string | null;
    issues: { level: string; code: string; message: string }[];
  };
  supervisor?: {
    status: string;
    pid: number | null;
    alive: boolean;
    restart_count: number;
    last_restart_at: string | null;
    last_restart_reason: string | null;
    last_error: string | null;
  };
  current_work: {
    sport: string | null;
    event: string | null;
    market: string | null;
    phase: string;
    last_update: string;
    note: string | null;
  } | null;
  source_health?: { source: string; availability: string; legal_access_status: string; events_found: number }[];
  challengers?: { model_id: string; role: string; status: string; auto_promotion: false }[];
  api_sports_057?: {
    health: {
      source: string;
      status: string;
      requests_today: number;
      remaining: number | null;
      sports: string[];
      data_types: string[];
      last_success: string | null;
      last_error: string | null;
      plan: string | null;
      key_configured: boolean;
      key_exposed: false;
    };
    budget: { used_day: number; remaining_day: number; limit_day: number; plan: string | null };
    key_exposed: false;
  };
  capital: string;
  real_money: false;
};

export default function LiveHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/permanent-live/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Health;
        if (alive) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const id = setInterval(load, 5000);
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
      <h1 className="mb-1 text-2xl font-semibold">Permanent Live Health</h1>
      <p className="mb-6 text-sm text-zinc-500">Local poll · zero Odds API · PAPER_ONLY</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {data && (
        <>
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-medium">SYSTEM · {data.system.status}</h2>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Official</dt>
                <dd>{(data.system as { official_status?: string }).official_status ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Worker PID</dt>
                <dd>
                  {data.system.worker_pid ?? "—"} · {data.system.worker_alive ? "ALIVE" : "DEAD"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Supervisor PID</dt>
                <dd>
                  {(data.system as { supervisor_pid?: number | null }).supervisor_pid ?? "—"} ·{" "}
                  {(data.system as { supervisor_alive?: boolean }).supervisor_alive ? "ALIVE" : "DEAD"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Heartbeat age</dt>
                <dd>
                  {data.system.heartbeat_age_ms != null
                    ? `${Math.round(data.system.heartbeat_age_ms / 1000)}s`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Last cycle</dt>
                <dd>{data.system.last_cycle_at ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Restarts / reason</dt>
                <dd>
                  {data.system.restart_count}
                  {(data.system as { last_restart_reason?: string | null }).last_restart_reason
                    ? ` · ${(data.system as { last_restart_reason?: string }).last_restart_reason}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Phase / sport</dt>
                <dd>
                  {(data.system as { phase?: string | null }).phase ?? "—"}
                  {(data.system as { sport?: string | null }).sport
                    ? ` · ${(data.system as { sport?: string }).sport}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Budget / API</dt>
                <dd>
                  {(data.system as { budget_state?: string | null }).budget_state ?? "—"} /{" "}
                  {(data.system as { api_state?: string | null }).api_state ?? "—"}
                </dd>
              </div>
            </dl>
            {data.supervisor && (
              <p className="mt-2 text-sm">
                SUPERVISOR {data.supervisor.status} · pid {data.supervisor.pid ?? "—"} · alive=
                {String(data.supervisor.alive)} · restarts {data.supervisor.restart_count}
              </p>
            )}
            {data.system.issues.length > 0 && (
              <ul className="mt-3 text-sm text-amber-700 dark:text-amber-400">
                {data.system.issues.map((i) => (
                  <li key={i.code}>
                    [{i.level}] {i.code}: {i.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-medium">CURRENT WORK</h2>
            {data.current_work ? (
              <p className="text-sm">
                {data.current_work.phase}
                {data.current_work.sport ? ` · ${data.current_work.sport}` : ""}
                {data.current_work.event ? ` · ${data.current_work.event}` : ""}
                {data.current_work.market ? ` · ${data.current_work.market}` : ""}
                <span className="block text-xs text-zinc-500">
                  {data.current_work.last_update} · {data.current_work.note}
                </span>
              </p>
            ) : (
              <p className="text-sm text-zinc-500">No current work recorded</p>
            )}
          </section>
          {data.api_sports_057 && (
            <section className="mb-6">
              <h2 className="mb-2 text-lg font-medium">API-Sports</h2>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Status</dt>
                  <dd>{data.api_sports_057.health.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Plan</dt>
                  <dd>{data.api_sports_057.health.plan ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Requests today</dt>
                  <dd>
                    {data.api_sports_057.budget.used_day} / {data.api_sports_057.budget.limit_day}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Remaining</dt>
                  <dd>{data.api_sports_057.budget.remaining_day}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-zinc-500">Data types</dt>
                  <dd>{data.api_sports_057.health.data_types.join(", ") || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-zinc-500">Last error</dt>
                  <dd className="truncate">{data.api_sports_057.health.last_error ?? "—"}</dd>
                </div>
              </dl>
              <p className="mt-1 text-xs text-zinc-500">key_exposed=false · never shown</p>
            </section>
          )}
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-medium">Sources</h2>
            <ul className="text-sm">
              {(data.source_health ?? []).map((s) => (
                <li key={s.source} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                  <span>
                    {s.source} · {s.availability}
                  </span>
                  <span>
                    {s.legal_access_status} · events {s.events_found}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-medium">Challengers</h2>
            <ul className="text-sm">
              {(data.challengers ?? []).map((c) => (
                <li key={c.model_id}>
                  {c.role} {c.model_id} · {c.status} · auto_promotion={String(c.auto_promotion)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              capital={data.capital} · real_money={String(data.real_money)} · open_task_054=false
            </p>
          </section>
        </>
      )}
    </main>
  );
}
