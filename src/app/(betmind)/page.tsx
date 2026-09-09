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
  const decision = String(firstEv.decision ?? firstEv.prediction_status ?? "");
  if (/INSUFFICIENT|UNAVAILABLE|SKIP/i.test(decision)) return false;
  const model = firstEv.model_pct ?? firstEv.probability_model ?? firstEv.model_probability;
  if (model == null) return false;
  if (typeof model === "number" && Number.isFinite(model) && model >= 0 && model <= 100) return true;
  if (typeof model === "object") return Object.keys(model as object).length > 0;
  return false;
}

function runtimeState(strip: { brain: BmState; worker: BmState; dataPipeline: BmState }): BmState {
  if (strip.brain === "ONLINE" && strip.worker === "ONLINE") return "ONLINE";
  if (strip.brain === "OFFLINE" && strip.worker === "OFFLINE") return "OFFLINE";
  if (strip.brain === "DEGRADED" || strip.worker === "DEGRADED" || strip.brain === "ONLINE") {
    return "DEGRADED";
  }
  return "UNKNOWN";
}

export default function BetMindHomePage() {
  const { data, health, coverage, strip, error, updating, lastUpdate } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const healthBody = asRecord(health) ?? asRecord(data?.health);
  const sys = asRecord(obs?.system) ?? asRecord(healthBody?.system);
  const detail = asRecord(healthBody?.detail) ?? asRecord(health?.detail);
  const analysis =
    asRecord((data as { analysis?: unknown } | null)?.analysis) ??
    asRecord(obs?.analysis) ??
    asRecord(healthBody?.analysis);
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
  const settlements = data?.recent_settlements ?? [];

  const storePresent =
    detail?.store_present === true || detail?.store_present_local_on_publisher === true;
  const mirrored = detail?.mirror_source === "neon" || (data as { mirror_source?: string } | null)?.mirror_source === "neon";
  const livePrediction = hasLivePrediction(firstEv) && strip.brain !== "OFFLINE";
  const rt = runtimeState(strip);
  const engine = strip.predictiveEngine;

  const capital =
    typeof paper?.current_flat === "number"
      ? (paper.current_flat as number)
      : typeof asRecord(obs?.multisource_055)?.paper_bankroll === "number"
        ? (asRecord(obs?.multisource_055)?.paper_bankroll as number)
        : null;

  const phase = String(activity?.phase ?? (analysis?.idle ? "IDLE" : "UNKNOWN"));
  const lastCycle = String(
    analysis?.last_cycle_at ?? sys?.last_cycle_at ?? detail?.last_cycle_at ?? "",
  );
  const cycleNum = analysis?.cycle_number ?? detail?.cycles_completed ?? null;
  const modelName = String(
    analysis?.model_version ??
      verdict?.model_independent ??
      firstEv?.model_version ??
      audit?.model_readiness ??
      "—",
  );
  const eventsAnalyzed = analysis?.events_analyzed ?? detail?.events_analyzed ?? null;
  const predictionsProduced =
    analysis?.predictions_produced ?? detail?.predictions_produced ?? null;
  const boardCount =
    analysis?.decisions_on_board ?? detail?.decisions_on_board ?? nextEvents.length;
  const noEvents =
    analysis?.no_events_available === true ||
    (Number(boardCount) === 0 && Number(analysis?.events_in_store ?? 0) === 0);

  const statusRows: { name: string; state: BmState; detail: string }[] = [
    { name: "APP WEB", state: strip.webApp, detail: "Vercel / Next.js" },
    {
      name: "RUNTIME",
      state: rt,
      detail: mirrored
        ? `Mirror ${String(detail?.mirror_host ?? "neon")} · età ${String(detail?.mirror_age_ms ?? "—")} ms`
        : storePresent
          ? "Lab B locale"
          : "Nessun heartbeat runtime",
    },
    {
      name: "MOTORE PREDITTIVO",
      state: engine,
      detail: String(verdict?.model_independent ?? modelName),
    },
    {
      name: "PIPELINE DATI",
      state: strip.dataPipeline,
      detail: storePresent ? "Store Lab B presente (locale o publisher)" : "Store Lab B assente",
    },
    {
      name: "CERVELLO",
      state: strip.brain,
      detail: String(detail?.brain_status ?? sys?.status ?? "—"),
    },
    {
      name: "WORKER",
      state: strip.worker,
      detail: sys?.worker_pid != null ? `pid ${String(sys.worker_pid)}` : "nessun processo worker",
    },
  ];

  const blockers: string[] = [];
  if (rt === "OFFLINE") blockers.push("Runtime OFFLINE — PC worker not publishing a fresh heartbeat.");
  if (engine === "OFFLINE") blockers.push("Prediction engine OFFLINE.");
  if (coverage?.source === "memory") {
    blockers.push("Coverage endpoint is memory fallback — not an audited Lab B report.");
  }
  if (noEvents) {
    blockers.push(String(analysis?.no_events_reason ?? "NO EVENTS AVAILABLE on the decision board."));
  } else if (!livePrediction) {
    blockers.push("Board has events but no independent model_pct on the first row.");
  }

  const noPredictionReason = noEvents
    ? String(
        analysis?.no_events_reason ??
          "NO EVENTS AVAILABLE — last discovery/cycle recorded without board rows.",
      )
    : strip.brain === "OFFLINE"
      ? `Brain status is OFFLINE. Start the local brain (pnpm brain:start) then pnpm runtime:publish.`
      : nextEvents.length === 0
        ? "Decision board is empty in this snapshot."
        : "Event row exists but model probability fields are not present (INSUFFICIENT_DATA or not yet analyzed).";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="bm-section-label">Centro di controllo</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Bet<span className="bm-accent">Mind</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm bm-muted">
            Cruscotto onesto. App web ≠ Runtime ≠ Motore predittivo. Solo simulazione · REAL_MONEY=false.
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
            <div className="bm-section-label">Stato del sistema</div>
            <h2 className="mt-1 text-lg font-semibold">Striscia operativa</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill state={strip.webApp} label={`WEB ${strip.webApp}`} />
            <StatusPill state={rt} label={`RUNTIME ${rt}`} />
            <StatusPill state={engine} label={`ENGINE ${engine}`} />
          </div>
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
          <Pill>Last cycle {fmtWhen(lastCycle)}</Pill>
          <Pill>Cycle #{cycleNum != null ? String(cycleNum) : "—"}</Pill>
          <Pill>Heartbeat {String(sys?.heartbeat_age_ms ?? detail?.heartbeat_age_ms ?? "—")} ms</Pill>
          <Pill>Priority {String(analysis?.priority ?? sys?.last_priority ?? "—")}</Pill>
          <Pill>Supervisor {strip.supervisor}</Pill>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Analisi" className="lg:col-span-2">
          {noEvents ? (
            <EmptyState
              title="NESSUN EVENTO DISPONIBILE"
              reason={String(
                analysis?.no_events_reason ??
                  `Fase ${phase}. Ultimo ciclo ${fmtWhen(lastCycle)}. Niente di inventato.`,
              )}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label="Cycle"
                value={cycleNum != null ? `#${String(cycleNum)}` : "—"}
                accent
              />
              <Metric label="Phase" value={phase} />
              <Metric label="Completed at" value={fmtWhen(lastCycle)} />
                  <Metric
                    label="Eventi scoperti (store)"
                    value={String(analysis?.events_in_store ?? "—")}
                  />
                  <Metric
                    label="Eventi con previsioni (store)"
                    value={String(eventsAnalyzed ?? "—")}
                  />
                  <Metric
                    label="Saltati / non disponibili"
                    value={String(analysis?.skipped ?? "—")}
                  />
                  <Metric label="Previsioni prodotte" value={String(predictionsProduced ?? "—")} />
                  <Metric label="Board decisioni (finestra)" value={String(boardCount)} />
                  <Metric label="Nota" value={String(activity?.note ?? analysis?.reason ?? "—")} />
            </div>
          )}
        </Card>
        <Card title="Intelligenza predittiva">
          <div className="grid grid-cols-1 gap-3">
            <Metric label="Modello" value={modelName} accent />
            <Metric
              label="Indipendente"
              value={
                verdict?.model_is_market_only === false ||
                String(verdict?.model_independent ?? "").includes("INDEPENDENT")
                  ? "ATTIVO"
                  : String(audit?.model_readiness ?? "SCONOSCIUTO")
              }
            />
            <Metric
              label="Copertura dati"
              value={
                analysis?.data_coverage != null
                  ? fmtPct(analysis.data_coverage as number)
                  : coverage?.DATA_COVERAGE != null
                    ? fmtPct(coverage.DATA_COVERAGE as number)
                    : "—"
              }
            />
            <Metric label="Soglia modello" value={String(verdict?.verdict ?? audit?.model_readiness ?? "—")} />
          </div>
        </Card>
      </div>

      <Card
        title="Ultima previsione (board reale)"
        right={
          <Pill tone={livePrediction ? "accent" : "warn"}>
            {livePrediction ? "RIGA REALE" : "NESSUNA RIGA MODELLO"}
          </Pill>
        }
      >
        <p className="mb-3 text-xs bm-muted">
          MODELLO indipendente dalle quote. MERCATO / QUOTE solo per confronto, se presenti.
        </p>
        {!livePrediction ? (
          <EmptyState title="NESSUNA PREVISIONE LIVE DISPONIBILE" reason={noPredictionReason} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill tone="accent">MODEL {modelName}</Pill>
              <Pill>EDGE {edgeLabel(firstEv?.edge_status, firstEv?.edge)}</Pill>
              <Pill>{String(firstEv?.label ?? firstEv?.event_id)}</Pill>
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
              <Metric
                label="Feature coverage"
                value={
                  firstEv?.feature_coverage != null
                    ? fmtPct(firstEv.feature_coverage as number)
                    : "—"
                }
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Metric label="Competition" value={String(firstEv?.competition ?? "—")} />
              <Metric label="Kickoff" value={fmtWhen(String(firstEv?.kickoff_utc ?? ""))} />
              <Metric label="Analyzed at" value={fmtWhen(String(firstEv?.analyzed_at ?? ""))} />
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

      <Card title="Recent board" right={<Pill>{String(nextEvents.length)} rows</Pill>}>
        {nextEvents.length === 0 ? (
          <EmptyState
            title="NO BOARD EVENTS"
            reason={String(analysis?.no_events_reason ?? "Snapshot next_events is empty.")}
          />
        ) : (
          <ul className="divide-y divide-[var(--bm-border)] text-sm">
            {nextEvents.slice(0, 8).map((raw) => {
              const e = asRecord(raw);
              if (!e) return null;
              return (
                <li key={String(e.event_id)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{String(e.label ?? e.event_id)}</div>
                    <div className="text-xs bm-muted">
                      {String(e.competition ?? "—")} · {fmtWhen(String(e.kickoff_utc ?? ""))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs">
                    <Pill>{String(e.bucket ?? e.decision ?? "—")}</Pill>
                    <Pill tone="accent">
                      {e.model_pct != null ? `${fmtN(e.model_pct as number, 1)}%` : "no model%"}
                    </Pill>
                    <Pill>{edgeLabel(e.edge_status, e.edge)}</Pill>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/events" className="bm-btn bm-btn-ghost mt-3 text-xs">
          All events
        </Link>
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
            <Metric label="Settlements" value={String(settlements.length)} />
            <Metric label="Autopsies" value={String((data?.recent_autopsies ?? []).length)} />
            <Metric label="Learning" value={String(learn.length)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
              title="NO SETTLED CASES YET"
              reason="learning_cases is empty — not UNKNOWN. Settlement/learning loop has no cases yet."
            />
          )}
        </Card>
        <Card title="Settlement">
          {settlements.length === 0 ? (
            <EmptyState
              title="NO SETTLED CASES YET"
              reason="recent_settlements is empty — nothing invented."
            />
          ) : (
            <div className="space-y-2 text-sm">
              <Metric label="Recent settlements" value={String(settlements.length)} />
              <p className="bm-muted">
                Latest: {String(asRecord(settlements[0])?.event_id ?? "—")} ·{" "}
                {String(asRecord(settlements[0])?.outcome ?? "—")}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
