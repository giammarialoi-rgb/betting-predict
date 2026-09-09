"use client";

import Link from "next/link";
import {
  Card,
  LiveBadge,
  Metric,
  Pill,
  StatusDot,
  Unknown,
  asRecord,
  edgeLabel,
  fmtMoney,
  fmtN,
  fmtPct,
} from "@/components/betmind/ui";
import { useBetMindSnapshot } from "@/components/betmind/useSnapshot";

function serviceState(ok: boolean | null | undefined): "online" | "down" | "degraded" | "unknown" {
  if (ok === true) return "online";
  if (ok === false) return "down";
  return "unknown";
}

export default function BetMindHomePage() {
  const { data, error, updating, lastUpdate } = useBetMindSnapshot(4000);
  const obs = asRecord(data?.observatory);
  const health = asRecord(data?.health);
  const sys = asRecord(obs?.system) ?? asRecord(health?.system);
  const brain = asRecord(obs?.brain) ?? asRecord(health?.brain);
  const activity =
    asRecord(asRecord(obs?.multisource_055)?.current_activity) ??
    asRecord(obs?.current_work) ??
    asRecord(health?.current_work);
  const audit = asRecord(obs?.audit_056);
  const nextEvents = (obs?.next_events as unknown[]) ?? [];
  const firstEv = asRecord(nextEvents[0]);
  const verdict = asRecord(data?.predictive?.final_verdict);
  const holdout = asRecord(asRecord(data?.predictive?.validation)?.holdout);
  const metrics = asRecord(holdout?.metrics) ?? asRecord(data?.predictive?.validation);
  const independent = asRecord(metrics?.independent);
  const market = asRecord(metrics?.market);
  const paper = asRecord(asRecord(data?.predictive?.paper_bankroll_report)?.summary);
  const learn = data?.learning_cases ?? [];
  const learn0 = asRecord(learn[0]);

  const capital =
    typeof paper?.current_flat === "number"
      ? (paper.current_flat as number)
      : typeof asRecord(obs?.multisource_055)?.paper_bankroll === "number"
        ? (asRecord(obs?.multisource_055)?.paper_bankroll as number)
        : 1000;

  const brainStatus = String(brain?.status ?? sys?.status ?? "UNKNOWN");
  const phase = String(activity?.phase ?? sys?.phase ?? "UNKNOWN");
  const idle = /IDLE|SLEEP|WAITING/i.test(phase) || !activity;

  const services: { name: string; state: "online" | "down" | "degraded" | "unknown"; detail: string }[] = [
    {
      name: "Brain",
      state: /HEALTHY|RUN|WORKING/i.test(brainStatus)
        ? "online"
        : /DEAD|STOPPED/i.test(brainStatus)
          ? "down"
          : /DEGRADED|PAUSED|RECOVER/i.test(brainStatus)
            ? "degraded"
            : "unknown",
      detail: brainStatus,
    },
    {
      name: "Supervisor",
      state: serviceState(
        typeof sys?.supervisor_alive === "boolean" ? (sys.supervisor_alive as boolean) : null,
      ),
      detail: String(sys?.official_status ?? "N/A"),
    },
    {
      name: "Worker",
      state: serviceState(
        typeof sys?.worker_alive === "boolean" ? (sys.worker_alive as boolean) : null,
      ),
      detail: sys?.worker_pid != null ? `pid ${sys.worker_pid}` : "N/A",
    },
    {
      name: "Data Pipeline",
      state: data && !error ? "online" : error ? "down" : "unknown",
      detail: data ? "snapshot ok" : "N/A",
    },
    {
      name: "Settlement",
      state: (data?.recent_settlements?.length ?? 0) > 0 ? "online" : "unknown",
      detail: `${data?.recent_settlements?.length ?? 0} recent`,
    },
    {
      name: "Learning",
      state: learn.length > 0 ? "online" : "unknown",
      detail: `${learn.length} cases`,
    },
  ];

  const modelName = String(
    verdict?.model_independent ?? firstEv?.model_version ?? audit?.model_readiness ?? "UNKNOWN",
  );
  const modelStatus = String(audit?.model_readiness ?? verdict?.verdict ?? "UNKNOWN");
  const edgeStatus = String(firstEv?.edge_status ?? "UNKNOWN");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="bm-section-label">BetMind Control Center</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Bet<span className="bm-accent">Mind</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <LiveBadge updating={updating} />
          <span className="bm-muted">
            {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "N/A"}
          </span>
        </div>
      </div>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">Snapshot error: {error}</p>
        </Card>
      )}

      <section className="bm-hero">
        <div className="bm-section-label">Brain Status</div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold">System health</h2>
          <Pill accent>{String(sys?.official_status ?? brainStatus)}</Pill>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li
              key={s.name}
              className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm">
                <StatusDot state={s.state} />
                {s.name}
              </span>
              <span className="text-[11px] uppercase tracking-wide bm-muted">
                {s.state} · {s.detail}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Pill>Heartbeat {String(sys?.heartbeat_age_ms ?? "N/A")} ms</Pill>
          <Pill>Priority {String(sys?.last_priority ?? "N/A")}</Pill>
          <Pill>Cycle {String(sys?.last_cycle_at ?? "N/A")}</Pill>
        </div>
      </section>

      <Card title="WHAT IS BETMIND DOING NOW?" glow>
        {idle ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold bm-accent">Waiting for next analysis</p>
            <p className="text-sm bm-muted">
              Phase: {phase}
              {activity?.note ? ` · ${String(activity.note)}` : ""}
            </p>
            <p className="text-xs bm-muted">
              Last cycle: {String(activity?.started_at ?? sys?.last_successful_cycle_at ?? "N/A")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Sport" value={String(activity?.sport ?? sys?.sport ?? "N/A")} />
            <Metric label="Event" value={String(activity?.event ?? activity?.event_id ?? sys?.event_id ?? "N/A")} />
            <Metric label="Market" value={String(activity?.market ?? sys?.market ?? "N/A")} />
            <Metric label="Phase" value={phase} accent />
            <Metric label="Priority" value={String(sys?.last_priority ?? "N/A")} />
            <Metric
              label="Last action"
              value={String(activity?.note ?? activity?.source ?? "N/A")}
            />
            <Metric
              label="Timestamp"
              value={String(activity?.started_at ?? activity?.last_update ?? sys?.last_cycle_at ?? "N/A")}
            />
          </div>
        )}
      </Card>

      <Card
        title="PREDICTIVE INTELLIGENCE"
        glow
        right={<Pill accent>{modelStatus}</Pill>}
      >
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Pill>MODEL {modelName}</Pill>
          <Pill>VERSION {String(firstEv?.model_version ?? verdict?.model_independent ?? "N/A")}</Pill>
          <Pill accent>EDGE {edgeLabel(edgeStatus, firstEv?.edge)}</Pill>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-[rgba(0,246,117,0.25)] bg-[rgba(0,246,117,0.06)] p-3">
            <div className="bm-section-label">Model</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Metric
                label="Model %"
                value={firstEv?.model_pct != null ? fmtN(firstEv.model_pct as number, 1) : "N/A"}
                accent
              />
              <Metric
                label="Confidence"
                value={
                  firstEv?.confidence != null
                    ? fmtPct(firstEv.confidence as number)
                    : "N/A"
                }
              />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--bm-border)] bg-black/20 p-3">
            <div className="bm-section-label">Market</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Metric
                label="Market %"
                value={firstEv?.market_pct != null ? fmtN(firstEv.market_pct as number, 1) : "N/A"}
              />
              <Metric
                label="Odds"
                value={firstEv?.odds != null ? fmtN(firstEv.odds as number, 2) : "N/A"}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="EDGE" value={edgeLabel(edgeStatus, firstEv?.edge)} accent />
          <Metric label="EV" value={firstEv?.ev != null ? fmtN(firstEv.ev as number, 3) : "N/A"} />
          <Metric label="Decision" value={String(firstEv?.decision ?? "N/A")} />
          <Metric label="Selection" value={String(firstEv?.selection ?? "N/A")} />
        </div>
        <div className="mt-3">
          <div className="bm-metric-label">WHY</div>
          <p className="mt-1 text-sm leading-relaxed">{String(firstEv?.why ?? "INSUFFICIENT_DATA")}</p>
        </div>
        {typeof firstEv?.event_id === "string" && (
          <Link href={`/events/${firstEv.event_id}`} className="bm-btn bm-btn-ghost mt-4 text-xs">
            Open current event
          </Link>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="PAPER BANKROLL" glow>
          <div className="text-3xl font-bold tracking-tight">{fmtMoney(capital)}</div>
          <div className="mt-1 text-xs bm-muted">Initial €1000 · REAL_MONEY=false</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="P&L" value={fmtMoney(paper?.profit_flat as number | undefined)} />
            <Metric label="ROI" value={fmtPct(paper?.roi_flat as number | undefined)} />
            <Metric label="Drawdown" value={fmtPct(paper?.max_drawdown_flat as number | undefined)} />
            <Metric label="Bets" value={String(paper?.n_settled ?? paper?.bets ?? "N/A")} />
            <Metric label="Won" value={String(paper?.wins ?? "N/A")} />
            <Metric label="Lost" value={String(paper?.losses ?? "N/A")} />
          </div>
          <div className="mt-3">
            <Pill accent>REAL_MONEY=false</Pill>
          </div>
        </Card>

        <Card title="PERFORMANCE">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Log Loss" value={independent ? fmtN(independent.log_loss as number) : "UNKNOWN"} />
            <Metric label="Brier" value={independent ? fmtN(independent.brier as number) : "UNKNOWN"} />
            <Metric label="Accuracy" value={independent ? fmtPct(independent.accuracy as number) : "UNKNOWN"} />
            <Metric
              label="vs Market LL"
              value={market ? fmtN(market.log_loss as number) : "N/A"}
            />
            <Metric label="Settled" value={String((data?.recent_settlements ?? []).length)} />
            <Metric label="Autopsies" value={String((data?.recent_autopsies ?? []).length)} />
            <Metric label="Learning" value={String(learn.length)} />
            <Metric label="MODEL_EDGE" value={String(asRecord(verdict?.promotion_gate)?.model_edge ?? "UNKNOWN")} accent />
          </div>
        </Card>
      </div>

      <Card title="WHAT DID BETMIND LEARN?" glow>
        {learn0 ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Pill accent>{String(learn0.category ?? learn0.case_type ?? "CASE")}</Pill>
              <Pill>{String(learn0.stake_outcome ?? learn0.decision_correctness ?? "N/A")}</Pill>
            </div>
            <p>
              Event <Link className="bm-accent underline" href={`/events/${String(learn0.event_id)}`}>{String(learn0.event_id).slice(0, 12)}…</Link>
            </p>
            <p className="bm-muted">
              actual={String(learn0.actual ?? "N/A")} · error=
              {learn0.probability_error != null ? fmtN(learn0.probability_error as number, 3) : "N/A"} ·{" "}
              {String(learn0.calibration_note ?? learn0.note ?? "N/A")}
            </p>
            <Link href="/learn" className="bm-btn bm-btn-ghost mt-2 text-xs">
              Open Learn
            </Link>
          </div>
        ) : (
          <Unknown label="INSUFFICIENT_DATA — no learning cases on disk" />
        )}
      </Card>
    </div>
  );
}
