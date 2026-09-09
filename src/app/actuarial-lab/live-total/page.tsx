"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { reactListKey052 } from "@/domain/eval/ui-052/keys";

type Center = {
  server_time: string;
  api_calls_ui: 0;
  seed_note: string;
  daemon: {
    display: string;
    pid: number | null;
    pid_alive: boolean;
    started_at: string | null;
    last_cycle_at: string | null;
    last_discovery_at: string | null;
    last_settlement_at: string | null;
    last_error: string | null;
    last_activity_human: string;
    degraded_reason: string | null;
    mode: string;
  };
  budget: {
    credits_remaining: number | null;
    credits_used: number | null;
    monthly_limit: number;
    safe_reserve: number;
    api_calls_today: number;
    budget_used_pct: number | null;
  };
  counters: {
    TOTAL_EVENTS: number;
    SEED_EVENTS: number;
    DISCOVERED_LIVE: number;
    SOCCER: number;
    TENNIS: number;
    OTHER: number;
    PREDICTIONS: number;
    LOCKS: number;
    SETTLEMENTS: number;
    AUTOPSIES: number;
    LEARNING_CASES: number;
    TODAY: Record<string, number>;
  };
  pipeline: { phase: string; completed: number; pending: number; last_at: string | null }[];
  feed: { at: string; kind: string; summary: string; event_id?: string }[];
  next_events: {
    event_id: string;
    kickoff_utc: string | null;
    sport: string;
    competition: string;
    label: string;
    minutes_to_kickoff: number | null;
    near_t1h: boolean;
    status: string;
    markets: string[];
    prediction_status: string;
    lock_status: string;
    selection: string | null;
    confidence: number | null;
    model_pct?: number | null;
    market_pct?: number | null;
    edge?: number | null;
    ev?: number | null;
    odds?: number | null;
    decision?: string;
    stake?: number;
    why?: string;
    fair_odds?: number | null;
    model_version?: string | null;
    result?: string | null;
    pnl?: number | null;
    model_ne_market?: boolean;
    edge_status?: "KNOWN" | "UNKNOWN" | "LOW";
  }[];
  audit_056?: {
    AUTOSTART_STATUS: string;
    AUTOSTART_VERIFIED: boolean;
    diagnostics: { ok: boolean; issues: { code: string; level: string; message: string; count?: number }[] };
    decision_board_count: number;
    model_readiness: string;
    canonical_chain: string;
    open_task_057: false;
  };
  ranking: {
    analyzed_events: number;
    candidates: number;
    no_bet_records: number;
    note: string;
    top20: { rank: number; event_id: string; sport: string; prediction: string | null; confidence: number; status: string }[];
  };
  intelligence: {
    settled: number;
    correct: number;
    incorrect: number;
    autopsied: number;
    learning_cases: number;
    error_patterns: number;
  };
  model: { version: string; status: string; edge: string };
  capital: { CAPITAL: string; REAL_MONEY: boolean; AUTO_PROMOTION: boolean };
  coverage_047?: {
    tennis_status: string;
    tennis_discovery: string;
    horizons: { TODAY: number; NEXT_24H: number; NEXT_72H: number; NEXT_7D: number };
    markets_observed: string[];
    quote_observations: number;
    rankings: {
      TOP_ANALYTICAL: string[];
      TOP_EDGE: string[];
      TOP_CONFIDENCE: string[];
      TOP_LOW_RISK: string[];
      TOP_20_NEXT_72H: {
        rank: number;
        event_id: string;
        sport: string;
        market: string;
        prediction: string | null;
        probability: number | null;
        market_probability: number | null;
        edge: number | null;
        confidence: number;
        data_quality: number;
        main_reason: string;
        status: string;
      }[];
    };
    learning_patterns: { pattern: string; sample_size: number; status: string }[];
    pipeline_counters: Record<string, number>;
  };
  decision_048?: {
    model_version: string;
    parent_model: string;
    auto_promotion: false;
    capital: "CLOSED";
    metrics: {
      TOTAL_ANALYZED?: number;
      NO_BET: number;
      BET_CANDIDATE: number;
      STRONG_CANDIDATE: number;
      SETTLED: number;
      CORRECT?: number;
      WRONG?: number;
      MODEL_EDGE: string;
      note?: string;
    };
    bet_candidates: { event_id: string; prediction: string | null; confidence: number; estimated_edge: number | null; explanation: { WHY_PRIMARY: string } }[];
    strong_candidates: { event_id: string; prediction: string | null; confidence: number }[];
    no_bet_explanations: { event_id: string; why: string; codes: string[] }[];
    learning_status: { observation_only: true; error_patterns: { pattern: string; occurrences: number; status: string }[] };
    why_performance: { reason: string; n: number; correct: number }[];
  };
  massive_049?: {
    title: string;
    artificial_cap: false;
    catalog_note: string;
    adapters: string[];
    stats: Record<string, number | string | string[]>;
    sport_coverage: { family: string; status: string; keys_active: number; keys_pulled: number; events_in_lab: number; note: string | null }[];
    readiness: Record<string, string>;
  };
  brain_051?: {
    title: string;
    display: string;
    status: string;
    uptime_human: string;
    pid: number | null;
    pid_alive: boolean;
    watchdog_pid: number | null;
    heartbeat_at: string | null;
    heartbeat_age_ms: number | null;
    last_cycle_at: string | null;
    last_successful_cycle_at: string | null;
    last_priority: string;
    next_hint: string;
    cycles_completed: number;
    restart_count: number;
    consecutive_errors: number;
    last_error: string | null;
    model_version: string;
    capital: "CLOSED";
    real_money: false;
    auto_promotion: false;
    health_issues: { level: string; code: string; message: string }[];
    activity_feed: { at: string; kind: string; summary: string }[];
    store: {
      events: number;
      quotes: number;
      predictions: number;
      locks: number;
      settlements: number;
      events_jsonl_bytes: number;
      quotes_jsonl_bytes: number;
    };
    budget: { credits_remaining: number | null; credits_used: number; safe_reserve: number };
    sport_table: {
      sport: string;
      events: number;
      next_24h?: number;
      analyzed?: number;
      predicted?: number;
      locked?: number;
      settled?: number;
    }[];
    counters: Record<string, number>;
    api_calls_ui: 0;
  };
  bankroll_053?: {
    title: string;
    initial: number;
    current_flat: number;
    profit_flat: number;
    roi_flat: number;
    max_drawdown_flat: number;
    capital: string;
    real_money: false;
    qualification: string;
    model_edge: string;
    paper_capital?: string;
    open_entries: number;
    settle_entries: number;
    strategies: Record<string, { bankroll: number; bets: number; wins: number; losses: number; profit: number }>;
    goal_simulator: {
      start: number;
      goal: number;
      horizon_days: number;
      disclaimer: string;
      scenarios: { name: string; note: string; reach_goal_plausible: boolean | null }[];
    };
    live_pulse: Record<string, boolean | string | null>;
  };
  massive_053?: {
    title: string;
    artificial_cap: false;
    unique_events: number;
    raw_event_lines: number;
    sport_diagnostics: {
      sport: string;
      status: string;
      unique_events: number;
      next_24h: number;
      bet: number;
      no_bet: number;
      locked: number;
      settled: number;
      keys_active: number;
      keys_pulled: number;
      note: string | null;
    }[];
    bookmaker_count: number;
    model_edge: string;
    model_ready: string;
    capital: string;
    source_adapter: string;
  };
  catalog_054?: {
    title: string;
    artificial_cap: false;
    coverage: {
      catalog_events: number;
      odds_events: number;
      odds_available: number;
      odds_missing: number;
      matched: number;
      unmatched: number;
      conflicts: number;
      today: number;
      next_24h: number;
      next_72h: number;
      next_7d: number;
      analyzed_events: number;
      directa_status: string;
      directa_policy_status: string;
    };
    directa: {
      policy_status: string;
      status: string;
      reason: string;
      enabled: boolean;
      scraping_enabled: boolean;
    };
    current_activity: {
      phase: string;
      source: string;
      sport: string | null;
      events_processed: number;
      events_remaining: number;
      note: string;
    };
    activity_feed: { at: string; kind: string; summary: string }[];
    sources: Record<string, { events: number; status: string; last_error: string | null }>;
    by_sport?: Record<string, { catalog: number; odds: number; missing_odds: number }>;
    paper_bankroll: 1000;
    capital: string;
    model_edge: string;
  };
  multisource_055?: {
    title: string;
    artificial_cap: false;
    coverage: {
      catalog_events: number;
      universal_events: number;
      odds_available: number;
      odds_missing: number;
      matched_pairs: number;
      conflicts: number;
      today: number;
      next_24h: number;
      next_72h: number;
      next_7d: number;
      next_30d: number;
      predictions: number;
      bet_candidates: number;
      strong_candidates: number;
      no_bet: number;
      watch: number;
      locked: number;
      settled: number;
      autopsies: number;
      learning_cases: number;
      markets: number;
      quotes: number;
      snapshots: number;
      by_sport: Record<string, { catalog: number; odds: number; analyzed: number; missing_odds: number }>;
    };
    source_monitor: {
      sourceId: string;
      status: string;
      events_discovered: number;
      events_matched: number;
      quotes: number;
      markets: number;
      last_error: string | null;
      reason: string | null;
      last_update: string | null;
    }[];
    rankings: {
      TOP_CONFIDENCE: string[];
      TOP_EDGE: string[];
      TOP_20_NEXT_24H: { event_id: string; confidence: number }[];
      TOP_20_NEXT_72H: unknown;
      note: string;
    };
    current_activity: {
      phase: string;
      source: string;
      sport: string | null;
      events_processed: number;
      events_remaining: number;
      note: string;
    };
    activity_feed: { at: string; kind: string; summary: string }[];
    paper_bankroll: 1000;
    capital: string;
    model_edge: string;
    real_money: false;
    auto_promotion: false;
  };
  consolidation_055?: {
    SYSTEM_STATUS: string;
    SUPERVISOR_ALIVE: boolean;
    WORKER_ALIVE: boolean;
    HEARTBEAT_FRESH: boolean;
    AUTOSTART_VERIFIED: boolean;
    ACTIVE_MECHANISM: string;
    PAPER_CAPITAL: number;
    PAPER_PNL: number;
    MODEL_EDGE: string;
    SPORT_STATUS: Record<string, { status: string; events: number; reason: string }>;
    CURRENT_WORK_VISIBLE: boolean;
  };
  autostart_055?: {
    AUTOSTART_INSTALLED: boolean;
    AUTOSTART_VERIFIED: boolean;
    ACTIVE_MECHANISM: string;
  } | null;
  system_053?: {
    status: string;
    worker_pid: number | null;
    worker_alive: boolean;
    supervisor_pid?: number | null;
    supervisor_alive?: boolean;
    official_status?: string;
    heartbeat_at: string | null;
    heartbeat_age_ms: number | null;
    last_cycle_at: string | null;
    last_successful_cycle_at: string | null;
    last_priority: string | null;
    restart_count: number;
    last_restart_at?: string | null;
    last_restart_reason?: string | null;
    consecutive_errors: number;
    uptime_hint: string | null;
    issues: { level: string; code: string; message: string }[];
    phase?: string | null;
    sport?: string | null;
    event_id?: string | null;
    market?: string | null;
    budget_state?: string | null;
    api_state?: string | null;
  };
  current_work_053?: {
    sport: string | null;
    event: string | null;
    market: string | null;
    phase: string;
    started_at: string | null;
    last_update: string;
    note: string | null;
  } | null;
  sport_adapters_053?: {
    sport: string;
    provider: string;
    availability: string;
    status: string;
    supportedMarkets: string[];
  }[];
  source_health_053?: {
    source: string;
    availability: string;
    legal_access_status: string;
    events_found: number;
  }[];
  challengers_053?: { model_id: string; role: string; status: string; auto_promotion: false }[];
};

function statusDot(display: string): string {
  if (display === "RUNNING") return "🟢";
  if (display === "DEGRADED") return "🟡";
  if (display === "ERROR") return "🔴";
  return "⚫";
}

function fmtMins(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return "—";
  if (m < 0) return `started ${Math.abs(Math.round(m))}m ago`;
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

export default function LiveTotalControlCenterPage() {
  const [data, setData] = useState<Center | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uiUpdated, setUiUpdated] = useState<string>("—");
  const [eventSearch, setEventSearch] = useState("");
  const [eventPage, setEventPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/permanent-live/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Center;
        if (alive) {
          setData(json);
          setErr(null);
          setUiUpdated(new Date().toISOString());
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "fetch failed");
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        <Link href="/actuarial-lab">← Actuarial lab</Link> · <Link href="/actuarial-lab/collector">Collector 042</Link>
      </p>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">LIVE TOTAL OBSERVATORY</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Autonomous 24/7 brain · Lab B disk-only · browser never calls Odds API · capital closed
        </p>
        <p className="text-sm">
          <Link href="/actuarial-lab/live-total/health" className="underline">
            Health
          </Link>
          {" · "}
          <Link href="/actuarial-lab/live-total/activity" className="underline">
            Activity feed
          </Link>
        </p>
        {data?.brain_051 && (
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-lg font-medium">
              {statusDot(data.brain_051.display)} {data.brain_051.display}
            </span>
            <span>PID {data.brain_051.pid ?? "—"}</span>
            <span>WD {data.brain_051.watchdog_pid ?? "—"}</span>
            <span>Uptime {data.brain_051.uptime_human}</span>
            <span>Priority {data.brain_051.last_priority}</span>
            <span>Model {data.brain_051.model_version}</span>
            <span className="text-zinc-500">UI {uiUpdated.slice(11, 19)} · Server {data.server_time.slice(11, 19)}</span>
          </div>
        )}
        {!data?.brain_051 && data && (
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-lg font-medium">
              {statusDot(data.daemon.display)} {data.daemon.display}
            </span>
            <span>PID {data.daemon.pid ?? "—"}</span>
            <span>Last activity: {data.daemon.last_activity_human}</span>
            <span>Mode: {data.daemon.mode}</span>
            <span className="text-zinc-500">UI {uiUpdated.slice(11, 19)} · Server {data.server_time.slice(11, 19)}</span>
          </div>
        )}
        {data?.daemon.degraded_reason && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{data.daemon.degraded_reason}</p>
        )}
        {data?.brain_051?.last_error && <p className="text-sm text-red-600">Last error: {data.brain_051.last_error}</p>}
        {!data?.brain_051 && data?.daemon.last_error && (
          <p className="text-sm text-red-600">Last error: {data.daemon.last_error}</p>
        )}
      </header>

      {err && <p className="text-red-600">{err}</p>}

      {data && (
        <>
          {(data.system_053 || data.current_work_053) && (
            <section className="grid gap-6 md:grid-cols-2">
              {data.system_053 && (
                <div>
                  <h2 className="mb-2 text-lg font-medium">SYSTEM</h2>
                  <p className="mb-2 text-sm">
                    {data.system_053.status}
                    {data.system_053.official_status ? ` · ${data.system_053.official_status}` : ""}
                    {!data.system_053.worker_alive && data.system_053.supervisor_alive
                      ? " · RECOVERING"
                      : !data.system_053.worker_alive && data.system_053.worker_pid != null
                        ? " · WORKER_DEAD"
                        : data.system_053.worker_alive
                          ? " · WORKER_ALIVE"
                          : ""}
                    {data.system_053.supervisor_alive ? " · SUPERVISOR_ALIVE" : " · SUPERVISOR_MISSING"}
                    {data.system_053.heartbeat_age_ms != null && data.system_053.heartbeat_age_ms > 20 * 60_000
                      ? " · HEARTBEAT_STALE"
                      : ""}
                  </p>
                  <dl className="grid gap-1 text-sm">
                    <Row k="Worker PID" v={String(data.system_053.worker_pid ?? "—")} />
                    <Row k="Supervisor PID" v={String(data.system_053.supervisor_pid ?? "—")} />
                    <Row
                      k="Heartbeat age"
                      v={
                        data.system_053.heartbeat_age_ms != null
                          ? `${Math.round(data.system_053.heartbeat_age_ms / 1000)}s`
                          : "—"
                      }
                    />
                    <Row k="Last cycle" v={data.system_053.last_cycle_at ?? "—"} />
                    <Row k="Priority" v={data.system_053.last_priority ?? "—"} />
                    <Row k="Restarts" v={String(data.system_053.restart_count)} />
                    <Row k="Last restart reason" v={data.system_053.last_restart_reason ?? "—"} />
                    <Row k="Phase" v={data.system_053.phase ?? "—"} />
                    <Row k="Errors" v={String(data.system_053.consecutive_errors)} />
                  </dl>
                </div>
              )}
              {data.current_work_053 && (
                <div>
                  <h2 className="mb-2 text-lg font-medium">CURRENT WORK</h2>
                  <p className="text-sm">
                    {data.current_work_053.phase}
                    {data.current_work_053.sport ? ` · ${data.current_work_053.sport}` : ""}
                  </p>
                  {data.current_work_053.event && <p className="text-sm">{data.current_work_053.event}</p>}
                  {data.current_work_053.market && (
                    <p className="text-sm text-zinc-500">{data.current_work_053.market}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    updated {data.current_work_053.last_update}
                    {data.current_work_053.note ? ` · ${data.current_work_053.note}` : ""}
                  </p>
                  {data.multisource_055?.activity_feed && data.multisource_055.activity_feed.length > 0 && (
                    <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {data.multisource_055.activity_feed.slice(0, 12).map((row, i) => (
                        <li key={`${row.at}-${i}`}>
                          [{row.at.slice(11, 19)}] {row.kind} {row.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}

          {(data.consolidation_055 || data.autostart_055) && (
            <section>
              <h2 className="mb-2 text-lg font-medium">CONSOLIDATION 055</h2>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                {data.consolidation_055 && (
                  <>
                    <Row k="System" v={data.consolidation_055.SYSTEM_STATUS} />
                    <Row
                      k="Supervisor / Worker"
                      v={`${data.consolidation_055.SUPERVISOR_ALIVE ? "ALIVE" : "DEAD"} / ${data.consolidation_055.WORKER_ALIVE ? "ALIVE" : "DEAD"}`}
                    />
                    <Row k="Heartbeat fresh" v={String(data.consolidation_055.HEARTBEAT_FRESH)} />
                    <Row
                      k="Autostart"
                      v={`${data.consolidation_055.AUTOSTART_VERIFIED ? "VERIFIED" : "UNVERIFIED"} · ${data.consolidation_055.ACTIVE_MECHANISM}`}
                    />
                    <Row k="Paper capital" v={String(data.consolidation_055.PAPER_CAPITAL)} />
                    <Row k="Paper PnL" v={String(data.consolidation_055.PAPER_PNL)} />
                    <Row k="Model edge" v={data.consolidation_055.MODEL_EDGE} />
                  </>
                )}
                {data.autostart_055 && !data.consolidation_055 && (
                  <Row
                    k="Autostart"
                    v={`${data.autostart_055.AUTOSTART_VERIFIED ? "VERIFIED" : "UNVERIFIED"} · ${data.autostart_055.ACTIVE_MECHANISM}`}
                  />
                )}
              </dl>
              {data.consolidation_055?.SPORT_STATUS && (
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {Object.entries(data.consolidation_055.SPORT_STATUS).map(([sport, row]) => (
                    <li key={sport} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-900">
                      <span>
                        {sport} · {row.status} · {row.events}
                      </span>
                      <span className="max-w-[55%] truncate text-xs text-zinc-500" title={row.reason}>
                        {row.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {data.audit_056 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">AUDIT 056 · DIAGNOSTICS</h2>
              <p className="mb-2 text-sm text-zinc-500">
                Autostart {data.audit_056.AUTOSTART_STATUS}
                {data.audit_056.AUTOSTART_VERIFIED ? " · verified" : " · unverified"} · model{" "}
                {data.audit_056.model_readiness} · board rows {data.audit_056.decision_board_count} ·{" "}
                {data.audit_056.canonical_chain}
              </p>
              <ul className="space-y-1 text-sm">
                {data.audit_056.diagnostics.issues.length === 0 && (
                  <li className="text-zinc-500">No diagnostic issues</li>
                )}
                {data.audit_056.diagnostics.issues.map((iss) => (
                  <li key={iss.code}>
                    [{iss.level}] {iss.code}: {iss.message}
                    {iss.count != null ? ` (n=${iss.count})` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.sport_adapters_053 && data.sport_adapters_053.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">Sport adapters</h2>
              <p className="mb-2 text-xs text-zinc-500">
                AVAILABLE ≠ EMPTY_WINDOW ≠ PROVIDER_UNAVAILABLE — never silent zero
              </p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {data.sport_adapters_053.map((a) => (
                  <li key={a.sport} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span>
                      {a.sport} · {a.availability}
                    </span>
                    <span className="text-xs text-zinc-500">{a.provider}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">{data.seed_note}</p>

          {data.brain_051 && (
            <section>
              <h2 className="mb-1 text-lg font-medium">{data.brain_051.title}</h2>
              <p className="mb-3 text-sm text-zinc-500">
                CAPITAL {data.brain_051.capital} · REAL_MONEY {String(data.brain_051.real_money)} · AUTO_PROMOTION{" "}
                {String(data.brain_051.auto_promotion)} · next cycle ~{data.brain_051.next_hint}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="EVENTS TODAY" value={data.brain_051.counters.EVENTS_TODAY ?? 0} />
                <Stat label="EVENTS TOTAL" value={data.brain_051.counters.EVENTS_TOTAL ?? 0} />
                <Stat label="PREDICTIONS" value={data.brain_051.counters.PREDICTIONS ?? 0} />
                <Stat label="LOCKED" value={data.brain_051.counters.LOCKED ?? 0} />
                <Stat label="SETTLED" value={data.brain_051.counters.SETTLED ?? 0} />
                <Stat label="AUTOPSIED" value={data.brain_051.counters.AUTOPSIED ?? 0} />
                <Stat label="LEARNING" value={data.brain_051.counters.LEARNING_CASES ?? 0} />
                <Stat label="CYCLES" value={data.brain_051.cycles_completed} />
                <Stat label="RESTARTS" value={data.brain_051.restart_count} />
                <Stat label="HEARTBEAT AGE" value={data.brain_051.heartbeat_age_ms != null ? `${Math.round(data.brain_051.heartbeat_age_ms / 1000)}s` : "—"} />
                <Stat label="LAST CYCLE" value={data.brain_051.last_cycle_at?.slice(11, 19) ?? "—"} />
                <Stat label="LAST OK" value={data.brain_051.last_successful_cycle_at?.slice(11, 19) ?? "—"} />
              </div>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Sport dashboard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-1 pr-3">SPORT</th>
                      <th className="py-1 pr-3">EVENTS</th>
                      <th className="py-1 pr-3">NEXT 24H</th>
                      <th className="py-1 pr-3">PREDICTED</th>
                      <th className="py-1 pr-3">LOCKED</th>
                      <th className="py-1">SETTLED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.brain_051.sport_table.map((r, idx) => (
                      <tr key={reactListKey052({ event_id: r.sport }, idx, "sport")} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-1 pr-3">{r.sport}</td>
                        <td className="py-1 pr-3">{r.events}</td>
                        <td className="py-1 pr-3">{r.next_24h ?? "—"}</td>
                        <td className="py-1 pr-3">{r.predicted ?? "—"}</td>
                        <td className="py-1 pr-3">{r.locked ?? "—"}</td>
                        <td className="py-1">{r.settled ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Health</h3>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {data.brain_051.health_issues.map((i, idx) => (
                      <li key={reactListKey052({ event_id: i.code, code: i.code, message: i.message }, idx, "health")}>
                        <span className={i.level === "CRITICAL" ? "text-red-600" : i.level === "ERROR" ? "text-amber-700" : "text-zinc-500"}>
                          [{i.level}] {i.code}
                        </span>{" "}
                        {i.message}
                      </li>
                    ))}
                    {!data.brain_051.health_issues.length && <li className="text-zinc-500">No issues</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Budget / store</h3>
                  <dl className="grid gap-1 text-sm">
                    <Row k="credits remaining" v={String(data.brain_051.budget.credits_remaining ?? "—")} />
                    <Row k="credits used" v={String(data.brain_051.budget.credits_used)} />
                    <Row k="safe reserve" v={String(data.brain_051.budget.safe_reserve)} />
                    <Row k="events stored" v={String(data.brain_051.store.events)} />
                    <Row k="quotes stored" v={String(data.brain_051.store.quotes)} />
                    <Row k="events.jsonl" v={`${data.brain_051.store.events_jsonl_bytes} B`} />
                  </dl>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Activity feed</h3>
                  <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
                    {data.brain_051.activity_feed.map((a, idx) => (
                      <li key={reactListKey052({ event_id: a.kind, at: a.at, kind: a.kind }, idx, "act")}>
                        [{a.at.slice(11, 19)}] {a.kind} — {a.summary}
                      </li>
                    ))}
                    {!data.brain_051.activity_feed.length && <li className="text-zinc-500">No activity yet</li>}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {data.massive_053 && (
            <section>
              <h2 className="mb-1 text-lg font-medium">{data.massive_053.title}</h2>
              <p className="mb-3 text-sm text-zinc-500">
                artificial_cap={String(data.massive_053.artificial_cap)} · unique {data.massive_053.unique_events} · raw
                lines {data.massive_053.raw_event_lines} · books {data.massive_053.bookmaker_count} · adapter{" "}
                {data.massive_053.source_adapter} · edge {data.massive_053.model_edge} · ready{" "}
                {data.massive_053.model_ready} · capital {data.massive_053.capital}
              </p>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Sport diagnostics</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-1 pr-2">SPORT</th>
                      <th className="py-1 pr-2">STATUS</th>
                      <th className="py-1 pr-2">EVENTS</th>
                      <th className="py-1 pr-2">NEXT 24H</th>
                      <th className="py-1 pr-2">BET</th>
                      <th className="py-1 pr-2">NO_BET</th>
                      <th className="py-1 pr-2">KEYS</th>
                      <th className="py-1">NOTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.massive_053.sport_diagnostics.map((s) => (
                      <tr key={s.sport} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-1 pr-2">
                          <Link className="underline" href={`/actuarial-lab/live-total/sport/${s.sport.toLowerCase()}`}>
                            {s.sport}
                          </Link>
                        </td>
                        <td className="py-1 pr-2">{s.status}</td>
                        <td className="py-1 pr-2">{s.unique_events}</td>
                        <td className="py-1 pr-2">{s.next_24h}</td>
                        <td className="py-1 pr-2">{s.bet}</td>
                        <td className="py-1 pr-2">{s.no_bet}</td>
                        <td className="py-1 pr-2">
                          {s.keys_pulled}/{s.keys_active}
                        </td>
                        <td className="py-1 text-xs text-zinc-500">{s.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {data.bankroll_053 && (
            <section>
              <h2 className="mb-1 text-lg font-medium">{data.bankroll_053.title}</h2>
              <p className="mb-3 text-sm text-zinc-500">
                {data.bankroll_053.qualification} · {data.bankroll_053.paper_capital ?? data.bankroll_053.capital} ·
                REAL_MONEY={String(data.bankroll_053.real_money)} · edge {data.bankroll_053.model_edge}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="INITIAL" value={data.bankroll_053.initial} />
                <Stat label="CURRENT (FLAT)" value={data.bankroll_053.current_flat} />
                <Stat label="PROFIT" value={data.bankroll_053.profit_flat} />
                <Stat label="ROI" value={data.bankroll_053.roi_flat} />
                <Stat label="MAX DD" value={data.bankroll_053.max_drawdown_flat} />
                <Stat label="OPEN ENTRIES" value={data.bankroll_053.open_entries} />
                <Stat label="SETTLES" value={data.bankroll_053.settle_entries} />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                {Object.entries(data.bankroll_053.strategies).map(([name, s]) => (
                  <div key={name} className="border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className="font-medium">{name}</div>
                    <div>
                      bankroll {s.bankroll} · bets {s.bets} · W/L {s.wins}/{s.losses} · P/L {s.profit}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-500">{data.bankroll_053.goal_simulator.disclaimer}</p>
              <ul className="mt-1 text-sm">
                {data.bankroll_053.goal_simulator.scenarios.map((sc) => (
                  <li key={sc.name}>
                    {sc.name}: {sc.note}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.catalog_054 && (
            <section>
              <h2 className="mb-1 text-lg font-medium">{data.catalog_054.title}</h2>
              <p className="mb-3 text-sm text-zinc-500">
                Directa {data.catalog_054.directa.policy_status} · {data.catalog_054.directa.reason} · paper{" "}
                {data.catalog_054.paper_bankroll} · edge {data.catalog_054.model_edge} · capital{" "}
                {data.catalog_054.capital}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="EVENTS TODAY" value={data.catalog_054.coverage.today} />
                <Stat label="NEXT 24H" value={data.catalog_054.coverage.next_24h} />
                <Stat label="NEXT 72H" value={data.catalog_054.coverage.next_72h} />
                <Stat label="NEXT 7D" value={data.catalog_054.coverage.next_7d} />
                <Stat label="CATALOG EVENTS" value={data.catalog_054.coverage.catalog_events} />
                <Stat label="WITH ODDS" value={data.catalog_054.coverage.odds_available} />
                <Stat label="WITHOUT ODDS" value={data.catalog_054.coverage.odds_missing} />
                <Stat label="MATCHED" value={data.catalog_054.coverage.matched} />
                <Stat label="UNMATCHED" value={data.catalog_054.coverage.unmatched} />
                <Stat label="CONFLICTS" value={data.catalog_054.coverage.conflicts} />
                <Stat label="ANALYZED" value={data.catalog_054.coverage.analyzed_events} />
              </div>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Current activity</h3>
              <p className="text-sm">
                {data.catalog_054.current_activity.phase} · {data.catalog_054.current_activity.source}
                {data.catalog_054.current_activity.sport ? ` · ${data.catalog_054.current_activity.sport}` : ""} ·
                processed {data.catalog_054.current_activity.events_processed} · remaining{" "}
                {data.catalog_054.current_activity.events_remaining}
              </p>
              <p className="text-xs text-zinc-500">{data.catalog_054.current_activity.note}</p>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Source coverage</h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(data.catalog_054.sources).map(([name, s]) => (
                  <li key={name} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span>
                      {name} · {s.status}
                    </span>
                    <span>events {s.events}</span>
                  </li>
                ))}
              </ul>

              {data.catalog_054.by_sport && Object.keys(data.catalog_054.by_sport).length > 0 && (
                <>
                  <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Sport catalog (dynamic)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-300 dark:border-zinc-700">
                          <th className="py-1 pr-2">SPORT</th>
                          <th className="py-1 pr-2">CATALOG</th>
                          <th className="py-1 pr-2">WITH ODDS</th>
                          <th className="py-1">MISSING ODDS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.catalog_054.by_sport).map(([sport, row]) => (
                          <tr key={sport} className="border-b border-zinc-100 dark:border-zinc-900">
                            <td className="py-1 pr-2 uppercase">{sport}</td>
                            <td className="py-1 pr-2">{row.catalog}</td>
                            <td className="py-1 pr-2">{row.odds}</td>
                            <td className="py-1">{row.missing_odds}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Source health · Directa</h3>
              <p className="text-sm">
                STATUS {data.catalog_054.directa.status} · POLICY {data.catalog_054.directa.policy_status} · enabled=
                {String(data.catalog_054.directa.enabled)} · scraping=
                {String(data.catalog_054.directa.scraping_enabled)}
              </p>
              <p className="text-xs text-zinc-500">{data.catalog_054.directa.reason}</p>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Catalog activity</h3>
              <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs">
                {data.catalog_054.activity_feed.map((a, idx) => (
                  <li key={`${a.at}-${idx}`}>
                    [{a.at.slice(11, 19)}] {a.kind} — {a.summary}
                  </li>
                ))}
                {!data.catalog_054.activity_feed.length && <li className="text-zinc-500">No catalog activity yet</li>}
              </ul>
            </section>
          )}

          {data.multisource_055 && (
            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-medium">{data.multisource_055.title}</h2>
                <Link href="/actuarial-lab/live-total/activity" className="text-sm underline">
                  Live activity feed →
                </Link>
              </div>
              <p className="mb-3 text-sm text-zinc-500">
                paper {data.multisource_055.paper_bankroll} · {data.multisource_055.capital} · edge{" "}
                {data.multisource_055.model_edge} · real_money={String(data.multisource_055.real_money)} · promo=
                {String(data.multisource_055.auto_promotion)} · artificial_cap=false
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="CATALOG / UNIVERSAL" value={data.multisource_055.coverage.universal_events} />
                <Stat label="TODAY" value={data.multisource_055.coverage.today} />
                <Stat label="NEXT 24H" value={data.multisource_055.coverage.next_24h} />
                <Stat label="NEXT 72H" value={data.multisource_055.coverage.next_72h} />
                <Stat label="NEXT 7D" value={data.multisource_055.coverage.next_7d} />
                <Stat label="NEXT 30D" value={data.multisource_055.coverage.next_30d} />
                <Stat label="WITH ODDS" value={data.multisource_055.coverage.odds_available} />
                <Stat label="WITHOUT ODDS" value={data.multisource_055.coverage.odds_missing} />
                <Stat label="PREDICTIONS" value={data.multisource_055.coverage.predictions} />
                <Stat label="BET CANDIDATES" value={data.multisource_055.coverage.bet_candidates} />
                <Stat label="STRONG" value={data.multisource_055.coverage.strong_candidates} />
                <Stat label="NO BET" value={data.multisource_055.coverage.no_bet} />
                <Stat label="LOCKED" value={data.multisource_055.coverage.locked} />
                <Stat label="SETTLED" value={data.multisource_055.coverage.settled} />
                <Stat label="AUTOPSIES" value={data.multisource_055.coverage.autopsies} />
                <Stat label="LEARNING" value={data.multisource_055.coverage.learning_cases} />
              </div>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Events by sport</h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(data.multisource_055.coverage.by_sport).map(([sport, row]) => (
                  <li key={sport} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span className="uppercase">{sport}</span>
                    <span>
                      catalog {row.catalog} · odds {row.odds} · analyzed {row.analyzed}
                    </span>
                  </li>
                ))}
                {!Object.keys(data.multisource_055.coverage.by_sport).length && (
                  <li className="text-zinc-500">No sport rows yet</li>
                )}
              </ul>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Source monitor</h3>
              <ul className="grid gap-1 text-sm">
                {data.multisource_055.source_monitor.map((s) => (
                  <li key={s.sourceId} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span>
                      {s.sourceId} · {s.status}
                    </span>
                    <span>
                      disc {s.events_discovered} · match {s.events_matched} · quotes {s.quotes}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Current activity</h3>
              <p className="text-sm">
                {data.multisource_055.current_activity.phase} · {data.multisource_055.current_activity.source} · processed{" "}
                {data.multisource_055.current_activity.events_processed}
              </p>

              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Rankings (analytical)</h3>
              <p className="mb-1 text-xs text-zinc-500">{data.multisource_055.rankings.note}</p>
              <p className="text-sm">
                TOP_CONFIDENCE: {data.multisource_055.rankings.TOP_CONFIDENCE.slice(0, 5).map((id) => id.slice(0, 10)).join(", ") || "—"}
              </p>
              <p className="text-sm">
                TOP 20 NEXT 24H: {data.multisource_055.rankings.TOP_20_NEXT_24H.length} rows
              </p>
            </section>
          )}

          {data.massive_049 && (
            <section>
              <h2 className="mb-1 text-lg font-medium">{data.massive_049.title}</h2>
              <p className="mb-3 text-sm text-zinc-500">{data.massive_049.catalog_note}</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="TOTAL ANALYZED" value={Number(data.massive_049.stats.TOTAL_EVENTS_ANALYZED)} />
                <Stat label="NEXT 24H" value={Number(data.massive_049.stats.NEXT_24H)} />
                <Stat label="NEXT 72H" value={Number(data.massive_049.stats.NEXT_72H)} />
                <Stat label="NEXT 7D" value={Number(data.massive_049.stats.NEXT_7D)} />
                <Stat label="SOCCER" value={Number(data.massive_049.stats.SOCCER)} />
                <Stat label="TENNIS" value={Number(data.massive_049.stats.TENNIS)} />
                <Stat label="BASKETBALL" value={Number(data.massive_049.stats.BASKETBALL)} />
                <Stat label="VOLLEYBALL" value={Number(data.massive_049.stats.VOLLEYBALL)} />
                <Stat label="HOCKEY" value={Number(data.massive_049.stats.HOCKEY)} />
                <Stat label="MARKETS ANALYZED" value={Number(data.massive_049.stats.MARKETS_ANALYZED)} />
                <Stat label="BET CANDIDATES" value={Number(data.massive_049.stats.BET_CANDIDATES)} />
                <Stat label="NO BET" value={Number(data.massive_049.stats.NO_BET)} />
              </div>
              <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Sport coverage</h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {data.massive_049.sport_coverage.map((s, idx) => (
                  <li key={reactListKey052({ event_id: s.family, family: s.family }, idx, "sc")} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span>
                      {s.family} · {s.status}
                    </span>
                    <span>
                      keys {s.keys_active}/{s.keys_pulled} · events {s.events_in_lab}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-500">
                Readiness: {Object.entries(data.massive_049.readiness).map(([k, v]) => `${k}=${v}`).join(" · ")}
              </p>
            </section>
          )}

          {data.coverage_047 && (
            <section>
              <h2 className="mb-3 text-lg font-medium">Live horizons / sports</h2>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="EVENTS TODAY" value={data.coverage_047.horizons.TODAY} />
                <Stat label="NEXT 24H" value={data.coverage_047.horizons.NEXT_24H} />
                <Stat label="NEXT 72H" value={data.coverage_047.horizons.NEXT_72H} />
                <Stat label="NEXT 7D" value={data.coverage_047.horizons.NEXT_7D} />
              </div>
              <p className="mt-3 text-sm">{data.coverage_047.tennis_discovery}</p>
              <p className="mt-1 text-sm text-zinc-500">
                MARKETS OBSERVED: {data.coverage_047.markets_observed.join(", ") || "none"} · quotes{" "}
                {data.coverage_047.quote_observations}
              </p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(data.coverage_047.pipeline_counters).map(([k, v]) => (
                  <Stat key={k} label={k} value={v} />
                ))}
              </div>
            </section>
          )}

          {data.decision_048 && (
            <section>
              <h2 className="mb-3 text-lg font-medium">Decision engine ({data.decision_048.model_version})</h2>
              <p className="mb-2 text-sm text-zinc-500">
                Lab classifications only · capital {data.decision_048.capital} · auto_promotion{" "}
                {String(data.decision_048.auto_promotion)} · parent {data.decision_048.parent_model}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="NO_BET" value={data.decision_048.metrics.NO_BET} />
                <Stat label="BET_CANDIDATE" value={data.decision_048.metrics.BET_CANDIDATE} />
                <Stat label="STRONG_CANDIDATE" value={data.decision_048.metrics.STRONG_CANDIDATE} />
                <Stat label="SETTLED" value={data.decision_048.metrics.SETTLED} />
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">BET candidates</h3>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {data.decision_048.bet_candidates.map((c, idx) => (
                      <li key={reactListKey052({ event_id: c.event_id, prediction: c.prediction, rank: idx }, idx, "bet")}>
                        <Link className="underline" href={`/actuarial-lab/live-total/event/${c.event_id}`}>
                          {c.event_id.slice(0, 14)}…
                        </Link>{" "}
                        {c.prediction ?? "—"} · conf {c.confidence}
                      </li>
                    ))}
                    {!data.decision_048.bet_candidates.length && <li className="text-zinc-500">None</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">NO_BET explanations</h3>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {data.decision_048.no_bet_explanations.map((c, idx) => (
                      <li
                        key={reactListKey052({ event_id: c.event_id, status: c.why }, idx, "nobet")}
                        className="border-b border-zinc-100 pb-1 dark:border-zinc-900"
                      >
                        <Link className="underline" href={`/actuarial-lab/live-total/event/${c.event_id}`}>
                          {c.event_id.slice(0, 12)}…
                        </Link>
                        <div className="text-zinc-500">{c.why}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {data.decision_048.learning_status.error_patterns.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Learning patterns</h3>
                  <ul className="text-sm">
                    {data.decision_048.learning_status.error_patterns.map((p, idx) => (
                      <li key={reactListKey052({ event_id: p.pattern, pattern: p.pattern }, idx, "ep")} className="flex justify-between gap-4">
                        <span>{p.pattern}</span>
                        <span>
                          n={p.occurrences} · {p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-2 text-lg font-medium">Daemon</h2>
              <dl className="grid gap-1 text-sm">
                <Row k="started_at" v={data.daemon.started_at ?? "—"} />
                <Row k="last_cycle_at" v={data.daemon.last_cycle_at ?? "—"} />
                <Row k="last_discovery_at" v={data.daemon.last_discovery_at ?? "—"} />
                <Row k="last_settlement_at" v={data.daemon.last_settlement_at ?? "—"} />
                <Row k="pid_alive" v={String(data.daemon.pid_alive)} />
              </dl>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-medium">API / Budget</h2>
              <dl className="grid gap-1 text-sm">
                <Row k="REMAINING" v={String(data.budget.credits_remaining ?? "—")} />
                <Row k="USED" v={String(data.budget.credits_used ?? "—")} />
                <Row k="SAFE RESERVE" v={String(data.budget.safe_reserve)} />
                <Row k="API CALLS TODAY" v={String(data.budget.api_calls_today)} />
                <Row k="UI API CALLS" v="0" />
              </dl>
              {data.budget.budget_used_pct != null && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-zinc-700 dark:bg-zinc-300"
                    style={{ width: `${data.budget.budget_used_pct}%` }}
                  />
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Counters</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="TOTAL EVENTS" value={data.counters.TOTAL_EVENTS} />
              <Stat label="SEED / DISCOVERED" value={`${data.counters.SEED_EVENTS} / ${data.counters.DISCOVERED_LIVE}`} />
              <Stat label="SOCCER / TENNIS / OTHER" value={`${data.counters.SOCCER} / ${data.counters.TENNIS} / ${data.counters.OTHER}`} />
              <Stat label="PREDICTIONS" value={data.counters.PREDICTIONS} />
              <Stat label="LOCKS" value={data.counters.LOCKS} />
              <Stat label="SETTLED / AUTOPSY / LEARN" value={`${data.counters.SETTLEMENTS} / ${data.counters.AUTOPSIES} / ${data.counters.LEARNING_CASES}`} />
            </div>
            <h3 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Today</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(data.counters.TODAY).map(([k, v]) => (
                <Stat key={k} label={k} value={v} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Pipeline</h2>
            <ol className="flex flex-col gap-2 text-sm">
              {data.pipeline.map((p, i) => (
                <li key={reactListKey052({ event_id: p.phase, phase: p.phase }, i, "pipe")} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 py-1 dark:border-zinc-800">
                  <span>
                    {i > 0 ? "↓ " : ""}
                    {p.phase}
                  </span>
                  <span>
                    done {p.completed} · pending {p.pending}
                    {p.last_at ? ` · last ${p.last_at.slice(11, 19)}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-medium">Event feed</h2>
              <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {data.feed.map((f, i) => (
                  <li key={reactListKey052({ event_id: f.event_id ?? "none", at: f.at, kind: f.kind }, i, "feed")} className="border-b border-zinc-100 pb-2 dark:border-zinc-900">
                    <div className="text-zinc-500">{f.at.slice(0, 19).replace("T", " ")}</div>
                    <div>
                      <span className="font-medium">{f.kind}</span>{" "}
                      {f.event_id ? (
                        <Link className="underline" href={`/actuarial-lab/live-total/event/${f.event_id}`}>
                          {f.summary}
                        </Link>
                      ) : (
                        f.summary
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-lg font-medium">Post-event intelligence</h2>
              <dl className="grid gap-1 text-sm">
                <Row k="SETTLED" v={String(data.intelligence.settled)} />
                <Row k="CORRECT / INCORRECT" v={`${data.intelligence.correct} / ${data.intelligence.incorrect}`} />
                <Row k="AUTOPSIED" v={String(data.intelligence.autopsied)} />
                <Row k="LEARNING CASES" v={String(data.intelligence.learning_cases)} />
                <Row k="ERROR PATTERNS" v={String(data.intelligence.error_patterns)} />
              </dl>
              <p className="mt-3 text-sm text-zinc-500">
                Model {data.model.version} · {data.model.status} · edge {data.model.edge} · capital {data.capital.CAPITAL}
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">TOP 20 NEXT 72H (informational — capital closed)</h2>
            <p className="mb-3 text-sm text-zinc-500">{data.ranking.note}</p>
            <p className="mb-2 text-sm">
              Analyzed {data.ranking.analyzed_events} · Candidates {data.ranking.candidates} · NO_BET records{" "}
              {data.ranking.no_bet_records}
            </p>
            {data.coverage_047 && (
              <div className="mb-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["TOP_CONFIDENCE", data.coverage_047.rankings.TOP_CONFIDENCE],
                    ["TOP_EDGE", data.coverage_047.rankings.TOP_EDGE],
                    ["TOP_ANALYTICAL", data.coverage_047.rankings.TOP_ANALYTICAL],
                    ["TOP_LOW_RISK", data.coverage_047.rankings.TOP_LOW_RISK],
                  ] as const
                ).map(([label, ids]) => (
                  <div key={label} className="border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className="mb-1 font-medium">{label}</div>
                    <ol className="list-decimal pl-4">
                      {ids.slice(0, 5).map((id, idx) => (
                        <li key={reactListKey052({ event_id: id }, idx, label)}>
                          <Link className="underline" href={`/actuarial-lab/live-total/event/${id}`}>
                            {id.slice(0, 12)}…
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            <ul className="grid gap-1 text-sm">
              {(data.coverage_047?.rankings.TOP_20_NEXT_72H ?? data.ranking.top20).map((r, idx) => (
                <li
                  key={reactListKey052(
                    {
                      event_id: r.event_id,
                      rank: r.rank,
                      market: "market" in r ? String((r as { market?: string }).market ?? "") : undefined,
                      prediction: r.prediction,
                    },
                    idx,
                    "top20",
                  )}
                  className="flex justify-between gap-4 border-b border-zinc-200 py-1 dark:border-zinc-800"
                >
                  <Link href={`/actuarial-lab/live-total/event/${r.event_id}`} className="underline">
                    #{r.rank} {r.sport} {r.event_id.slice(0, 14)}…
                  </Link>
                  <span>
                    {r.prediction ?? "—"} · conf {r.confidence}
                    {"edge" in r && r.edge != null ? ` · edge ${r.edge}` : ""} · {r.status}
                  </span>
                </li>
              ))}
              {!(data.coverage_047?.rankings.TOP_20_NEXT_72H ?? data.ranking.top20).length && (
                <li className="text-zinc-500">No upcoming ranked events in 72h horizon.</li>
              )}
            </ul>
          </section>

          {data.coverage_047 && data.coverage_047.learning_patterns.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">Learning patterns</h2>
              <ul className="grid gap-1 text-sm">
                {data.coverage_047.learning_patterns.map((p, idx) => (
                  <li key={reactListKey052({ event_id: p.pattern, pattern: p.pattern }, idx, "lp")} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span>{p.pattern}</span>
                    <span>
                      n={p.sample_size} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-medium">Next events</h2>
            <p className="mb-2 text-xs text-zinc-500">
              Full catalog from backend · UI pagination only (page size {pageSize}) · search does not limit acquisition
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={eventSearch}
                onChange={(e) => {
                  setEventSearch(e.target.value);
                  setEventPage(1);
                }}
                placeholder="Search team, league, sport, event_id…"
                className="min-w-[220px] flex-1 border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              />
            </div>
            {(() => {
              const q = eventSearch.trim().toLowerCase();
              const filtered = !q
                ? data.next_events
                : data.next_events.filter((e) => {
                    const blob = [
                      e.event_id,
                      e.label,
                      e.sport,
                      e.competition,
                      e.status,
                      e.prediction_status,
                      ...(e.markets ?? []),
                    ]
                      .join(" ")
                      .toLowerCase();
                    return blob.includes(q);
                  });
              const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
              const page = Math.min(eventPage, pages);
              const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
              return (
                <>
                  <p className="mb-2 text-xs text-zinc-500">
                    Showing {slice.length} of {filtered.length} (all backend rows: {data.next_events.length}) · page{" "}
                    {page}/{pages}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-300 dark:border-zinc-700">
                          <th className="py-2 pr-2">Time</th>
                          <th className="py-2 pr-2">Event</th>
                          <th className="py-2 pr-2">Market</th>
                          <th className="py-2 pr-2">Odds</th>
                          <th className="py-2 pr-2">Model%</th>
                          <th className="py-2 pr-2">Mkt%</th>
                          <th className="py-2 pr-2">Edge</th>
                          <th className="py-2 pr-2">EV</th>
                          <th className="py-2 pr-2">Decision</th>
                          <th className="py-2 pr-2">Stake</th>
                          <th className="py-2 pr-2">ModelVer</th>
                          <th className="py-2 pr-2">WHY</th>
                          <th className="py-2 pr-2">Result</th>
                          <th className="py-2 pr-2">P&L</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((e, idx) => (
                          <tr
                            key={reactListKey052(
                              {
                                event_id: e.event_id,
                                kickoff_utc: e.kickoff_utc,
                                sport: e.sport,
                                selection: e.selection,
                                prediction_status: e.prediction_status,
                                status: e.status,
                              },
                              idx,
                              "next",
                            )}
                            className={`border-b border-zinc-100 dark:border-zinc-900 ${e.near_t1h ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                          >
                            <td className="py-2 pr-2 whitespace-nowrap">
                              {e.kickoff_utc?.slice(0, 16).replace("T", " ") ?? "—"}
                            </td>
                            <td className="py-2 pr-2">
                              <Link href={`/actuarial-lab/live-total/event/${e.event_id}`} className="underline">
                                {e.label}
                              </Link>
                              <div className="text-xs text-zinc-500">
                                {e.sport} · {e.competition} · {fmtMins(e.minutes_to_kickoff)}
                              </div>
                            </td>
                            <td className="py-2 pr-2">{e.markets?.[0] ?? "—"}</td>
                            <td className="py-2 pr-2">{e.odds != null ? e.odds.toFixed(2) : "—"}</td>
                            <td className="py-2 pr-2">{e.model_pct != null ? `${e.model_pct}` : "—"}</td>
                            <td className="py-2 pr-2">{e.market_pct != null ? `${e.market_pct}` : "—"}</td>
                            <td className="py-2 pr-2" title={e.edge_status ?? ""}>
                              {e.edge_status === "UNKNOWN"
                                ? "UNKNOWN"
                                : e.edge != null
                                  ? e.edge.toFixed(3)
                                  : "—"}
                            </td>
                            <td className="py-2 pr-2">{e.ev != null ? e.ev.toFixed(3) : "—"}</td>
                            <td className="py-2 pr-2">{e.decision ?? e.prediction_status}</td>
                            <td className="py-2 pr-2">{e.stake != null ? e.stake : "—"}</td>
                            <td className="py-2 pr-2 text-xs">{e.model_version ?? "—"}</td>
                            <td className="py-2 pr-2 max-w-[220px] truncate text-xs" title={e.why ?? ""}>
                              {e.model_ne_market === false ? "MODEL≈MKT · " : ""}
                              {e.why ?? "—"}
                            </td>
                            <td className="py-2 pr-2">{e.result ?? "—"}</td>
                            <td className="py-2 pr-2">{e.pnl != null ? e.pnl.toFixed(2) : "—"}</td>
                            <td className="py-2">{e.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex gap-2 text-sm">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                      className="border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={page >= pages}
                      onClick={() => setEventPage((p) => Math.min(pages, p + 1))}
                      className="border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700"
                    >
                      Next
                    </button>
                  </div>
                </>
              );
            })()}
          </section>
        </>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}
