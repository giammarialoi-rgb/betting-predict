"use client";

import Link from "next/link";
import {
  Card,
  EmptyState,
  Metric,
  Pill,
  SnapshotBadge,
  StatusDot,
  StatusPill,
  asRecord,
  edgeLabel,
  fmtMoney,
  fmtN,
  fmtPct,
  fmtWhen,
  type BmState,
} from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";

function hasLivePrediction(firstEv: Record<string, unknown> | null): boolean {
  if (!firstEv) return false;
  const model = firstEv.model_pct ?? firstEv.probability_model ?? firstEv.model_probability;
  if (model == null) return false;
  if (typeof model === "number" && Number.isFinite(model)) return true;
  if (typeof model === "object") return Object.keys(model as object).length > 0;
  return false;
}

export default function BetMindHomePage() {
  const { data, health, coverage, strip, error, updating, lastUpdate } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const healthBody = asRecord(health) ?? asRecord(data?.health);
  const sys = asRecord(obs?.system) ?? asRecord(healthBody?.system);
  const detail = asRecord(healthBody?.detail) ?? asRecord(health?.detail);
  const activity =
    asRecord(asRecord(obs?.multisource_055)?.current_activity) ??
    asRecord(obs?.current_work) ??
    asRecord(healthBody?.current_work);
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

  const storePresent = detail?.store_present === true;
  const livePrediction = hasLivePrediction(firstEv) && strip.brain === "ONLINE";

  const capital =
    typeof paper?.current_flat === "number"
      ? (paper.current_flat as number)
      : typeof asRecord(obs?.multisource_055)?.paper_bankroll === "number"
        ? (asRecord(obs?.multisource_055)?.paper_bankroll as number)
        : null;

  const phase = String(activity?.phase ?? "UNKNOWN");
  const idle = /IDLE|SLEEP|WAITING|UNKNOWN/i.test(phase) || !activity || strip.brain !== "ONLINE";

  const statusRows: { name: string; state: BmState; detail: string }[] = [
    { name: "WEB APP", state: strip.webApp, detail: "Vercel / Next.js" },
    {
      name: "DATA PIPELINE",
      state: strip.dataPipeline,
      detail: storePresent ? "Lab B store present" : "Lab B store absent on this host",
    },
    {
      name: "BRAIN",
      state: strip.brain,
      detail: String(detail?.brain_status ?? sys?.status ?? "—"),
    },
    {
      name: "WORKER",
      state: strip.worker,
      detail: sys?.worker_pid != null ? `pid ${String(sys.worker_pid)}` : "no worker process",
    },
  ];

  const blockers: string[] = [];
  if (!storePresent) blockers.push("Lab B disk store not present on this host (expected on Vercel).");
  if (strip.brain !== "ONLINE") blockers.push("Brain is not ONLINE — no predictive cycle running here.");
  if (strip.worker !== "ONLINE") blockers.push("Worker is not ONLINE.");
  if (coverage?.source === "memory") blockers.push("Coverage is memory fallback — not an audited Lab B report.");
  if (!livePrediction) blockers.push("No live independent prediction on the decision board.");

  const modelName = String(
    verdict?.model_independent ?? firstEv?.model_version ?? audit?.model_readiness ?? "—",
  );

  const noPredictionReason = !storePresent
    ? "This host has no Lab B event store. Predictions require brain/worker writing to audit/external/task-044."
    : strip.brain !== "ONLINE"
      ? `Brain status is ${strip.brain}. Start the local/daemon brain to produce live assessments.`
      : nextEvents.length === 0
        ? "Decision board is empty — no next events in the observatory snapshot."
        : "Event row exists but model probability fields are not present (INSUFFICIENT_DATA or not yet analyzed).";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="bm-section-label">Control Center</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Bet<span className="bm-accent">Mind</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm bm-muted">
            Honest system dashboard. Web online ≠ Brain online. Paper only · REAL_MONEY=false.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SnapshotBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? fmtWhen(lastUpdate) : "—"}</span>
        </div>
      </div>

      {error && (
        <Card className="border-[rgba(229,72,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">Snapshot error: {error}</p>
        </Card>
      )}

      <section className="bm-hero">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="bm-section-label">System status</div>
            <h2 className="mt-1 text-lg font-semibold">Operational strip</h2>
          </div>
          <StatusPill state={strip.brain} label={`BRAIN ${strip.brain}`} />
        </div>
        <div className="bm-status-grid mt-4">
          {statusRows.map((s) => (
            <div key={s.name} className="bm-status-cell">
              <div className="bm-section-label">{s.name}</div>
              <strong className="inline-flex items-center gap-1.5">
                <StatusDot state={s.state} />
                {s.state}
              </strong>
              <p className="mt-1 truncate text-[11px] bm-muted">{s.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>Last cycle {fmtWhen(String(sys?.last_cycle_at ?? detail?.last_cycle_at ?? ""))}</Pill>
          <Pill>Heartbeat {String(sys?.heartbeat_age_ms ?? detail?.heartbeat_age_ms ?? "—")} ms</Pill>
          <Pill>Priority {String(sys?.last_priority ?? "—")}</Pill>
          <Pill>Supervisor {strip.supervisor}</Pill>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Current activity" className="lg:col-span-2">
          {idle ? (
            <EmptyState
              title="WAITING — NO ACTIVE ANALYSIS CYCLE"
              reason={`Phase ${phase}. Brain ${strip.brain}. Nothing is being invented for the board.`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Sport" value={String(activity?.sport ?? "—")} />
              <Metric label="Event" value={String(activity?.event ?? activity?.event_id ?? "—")} />
              <Metric label="Phase" value={phase} accent />
              <Metric label="Note" value={String(activity?.note ?? "—")} />
            </div>
          )}
        </Card>
        <Card title="At a glance">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Board events" value={String(nextEvents.length)} />
            <Metric
              label="Data coverage"
              value={
                coverage?.DATA_COVERAGE != null ? fmtPct(coverage.DATA_COVERAGE as number) : "—"
              }
            />
            <Metric label="Coverage src" value={String(coverage?.source ?? "—")} />
            <Metric label="Model gate" value={String(verdict?.verdict ?? audit?.model_readiness ?? "—")} />
          </div>
        </Card>
      </div>

      <Card
        title="Predictive intelligence"
        right={<Pill tone={livePrediction ? "accent" : "warn"}>{livePrediction ? "LIVE ROW" : "NO LIVE PREDICTION"}</Pill>}
      >
        <p className="mb-3 text-xs bm-muted">
          MODEL is independent of odds. MARKET / ODDS are compare-only when present.
        </p>
        {!livePrediction ? (
          <EmptyState title="NO LIVE PREDICTION AVAILABLE" reason={noPredictionReason} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill tone="accent">MODEL {modelName}</Pill>
              <Pill>EDGE {edgeLabel(firstEv?.edge_status, firstEv?.edge)}</Pill>
            </div>
            <div className="bm-split">
              <div className="bm-panel-model">
                <div className="bm-section-label">Model (independent)</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Metric
                    label="Model %"
                    value={firstEv?.model_pct != null ? fmtN(firstEv.model_pct as number, 1) : "—"}
                    accent
                  />
                  <Metric
                    label="Confidence"
                    value={
                      firstEv?.confidence != null ? fmtPct(firstEv.confidence as number) : "—"
                    }
                  />
                </div>
              </div>
              <div className="bm-panel-market">
                <div className="bm-section-label">Market / odds (baseline only)</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Metric
                    label="Market %"
                    value={firstEv?.market_pct != null ? fmtN(firstEv.market_pct as number, 1) : "—"}
                  />
                  <Metric
                    label="Odds"
                    value={firstEv?.odds != null ? fmtN(firstEv.odds as number, 2) : "—"}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="EDGE" value={edgeLabel(firstEv?.edge_status, firstEv?.edge)} accent />
              <Metric label="EV" value={firstEv?.ev != null ? fmtN(firstEv.ev as number, 3) : "—"} />
              <Metric label="Decision" value={String(firstEv?.decision ?? "—")} />
              <Metric label="Selection" value={String(firstEv?.selection ?? "—")} />
            </div>
            <div className="mt-3">
              <div className="bm-metric-label">Why</div>
              <p className="mt-1 text-sm leading-relaxed">{String(firstEv?.why ?? "—")}</p>
            </div>
            {typeof firstEv?.event_id === "string" && (
              <Link href={`/events/${firstEv.event_id}`} className="bm-btn bm-btn-ghost mt-4 text-xs">
                Open event
              </Link>
            )}
          </>
        )}
      </Card>

      <Card title="Blockers" glow={blockers.length > 0}>
        {blockers.length === 0 ? (
          <p className="text-sm bm-muted">No blockers reported from this snapshot.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {blockers.map((b) => (
              <li key={b} className="flex gap-2">
                <StatusDot state="OFFLINE" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/sources" className="bm-btn bm-btn-ghost text-xs">
            Data sources
          </Link>
          <Link href="/models" className="bm-btn bm-btn-ghost text-xs">
            Models
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Paper bankroll">
          <div className="text-3xl font-bold tracking-tight">
            {capital != null ? fmtMoney(capital) : "—"}
          </div>
          <div className="mt-1 text-xs bm-muted">
            {capital != null
              ? "From paper report · REAL_MONEY=false"
              : "No paper bankroll report on this host"}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="P&L" value={fmtMoney(paper?.profit_flat as number | undefined)} />
            <Metric label="ROI" value={fmtPct(paper?.roi_flat as number | undefined)} />
            <Metric label="Drawdown" value={fmtPct(paper?.max_drawdown_flat as number | undefined)} />
            <Metric label="Settled bets" value={String(paper?.n_settled ?? paper?.bets ?? "—")} />
          </div>
        </Card>

        <Card title="Holdout metrics (if present)">
          {independent ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Log Loss" value={fmtN(independent.log_loss as number)} />
              <Metric label="Brier" value={fmtN(independent.brier as number)} />
              <Metric label="Accuracy" value={fmtPct(independent.accuracy as number)} />
              <Metric label="vs Market LL" value={market ? fmtN(market.log_loss as number) : "—"} />
            </div>
          ) : (
            <EmptyState
              title="NO HOLDOUT METRICS ON DISK"
              reason="validation-report / holdout metrics are not present on this host."
            />
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Settlements" value={String((data?.recent_settlements ?? []).length)} />
            <Metric label="Autopsies" value={String((data?.recent_autopsies ?? []).length)} />
            <Metric label="Learning" value={String(learn.length)} />
          </div>
        </Card>
      </div>

      <Card title="Learning">
        {learn0 ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Pill tone="accent">{String(learn0.category ?? learn0.case_type ?? "CASE")}</Pill>
            </div>
            <p className="bm-muted">
              actual={String(learn0.actual ?? "—")} ·{" "}
              {String(learn0.calibration_note ?? learn0.note ?? "—")}
            </p>
            <Link href="/learn" className="bm-btn bm-btn-ghost mt-2 text-xs">
              Open Learn
            </Link>
          </div>
        ) : (
          <EmptyState
            title="NO LEARNING CASES"
            reason="learning_cases is empty on this host — no simulated lessons."
          />
        )}
      </Card>
    </div>
  );
}
