"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  EmptyState,
  Metric,
  Pill,
  SnapshotBadge,
  StatusDot,
  StatusPill,
  asRecord,
  fmtMoney,
  fmtN,
  fmtPct,
  fmtWhen,
  type BmState,
} from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";
import { PredictionOddsCard } from "@/components/betmind/PredictionOddsCard";
import {
  brainStatusIt,
  formatAgeIt,
  statusWordIt,
} from "@/domain/eval/betmind-runtime/status-copy";

function todayRome(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function mergePredictionRows(
  calendar: Record<string, unknown>[],
  board: unknown[],
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const raw of board) {
    const e = asRecord(raw);
    if (!e?.event_id) continue;
    byId.set(String(e.event_id), e);
  }
  for (const e of calendar) {
    const id = String(e.event_id ?? "");
    if (!id) continue;
    const prev = byId.get(id) ?? {};
    byId.set(id, { ...prev, ...e });
  }
  const rows = [...byId.values()];
  const rank = (e: Record<string, unknown>): number => {
    const model = asRecord(e.probability_model);
    const hasModel = Boolean(model && (model.HOME != null || model.DRAW != null || model.AWAY != null));
    const hasOdds = e.odds_home != null && e.odds_draw != null && e.odds_away != null;
    if (hasModel && hasOdds) return 0;
    if (hasModel) return 1;
    if (hasOdds) return 2;
    return 3;
  };
  rows.sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return String(a.kickoff_utc ?? "").localeCompare(String(b.kickoff_utc ?? ""));
  });
  const now = Date.now() - 3 * 3600_000;
  const upcoming = rows.filter((e) => {
    const t = Date.parse(String(e.kickoff_utc ?? ""));
    return !Number.isFinite(t) || t >= now;
  });
  return (upcoming.length ? upcoming : rows).slice(0, 8);
}

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
  const [calendarEvents, setCalendarEvents] = useState<Record<string, unknown>[]>([]);
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
  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    q.set("date", todayRome());
    q.set("sport", "ALL");
    fetch(`/api/events?${q.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const events = Array.isArray(body?.events) ? (body.events as Record<string, unknown>[]) : [];
        setCalendarEvents(events);
      })
      .catch(() => {
        if (!cancelled) setCalendarEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lastUpdate]);
  const predictionRows = useMemo(
    () => mergePredictionRows(calendarEvents, nextEvents),
    [calendarEvents, nextEvents],
  );
  const firstEv = asRecord(predictionRows[0]) ?? asRecord(nextEvents[0]);
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
  const mirrorStale =
    detail?.mirror_stale === true || (data as { mirror_stale?: boolean } | null)?.mirror_stale === true;
  const mirrorAge = Number(detail?.mirror_age_ms ?? (data as { mirror_age_ms?: number } | null)?.mirror_age_ms);
  const lastKnownBrain = String(detail?.last_known_brain_status ?? detail?.brain_status ?? sys?.status ?? "");
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
    { name: "App web", state: strip.webApp, detail: "Questa app su Vercel (Next.js)" },
    {
      name: "Runtime (PC)",
      state: rt,
      detail: mirrored
        ? `Specchio Neon da ${String(detail?.mirror_host ?? "giamm")} · ultimo segnale ${formatAgeIt(mirrorAge)}${mirrorStale ? " — scaduto" : ""}`
        : storePresent
          ? "Store Lab B su questo host"
          : "Nessun battito runtime ricevuto",
    },
    {
      name: "Motore predittivo",
      state: engine,
      detail: String(verdict?.model_independent ?? modelName),
    },
    {
      name: "Pipeline dati",
      state: strip.dataPipeline,
      detail: storePresent
        ? "Eventi presenti sul PC (publisher) — elenco via specchio Neon"
        : mirrored
          ? "Vercel non ha Lab B in locale; elenco da specchio Neon"
          : "Store Lab B assente su Vercel e nessuno specchio",
    },
    {
      name: "Cervello",
      state: strip.brain,
      detail: mirrorStale
        ? `${brainStatusIt("STALE_MIRROR")}. Ultimo stato noto: ${brainStatusIt(lastKnownBrain)}`
        : brainStatusIt(String(detail?.brain_status ?? sys?.status ?? "")),
    },
    {
      name: "Worker",
      state: strip.worker,
      detail:
        sys?.worker_pid != null
          ? `Processo ${String(sys.worker_pid)} sul PC`
          : strip.worker === "ONLINE"
            ? "Ciclo in corso sul PC"
            : "Nessun processo worker visibile da Vercel",
    },
  ];

  const blockers: string[] = [];
  if (mirrorStale) {
    blockers.push(
      `Specchio Neon scaduto (${formatAgeIt(mirrorAge)}). Il cervello sul PC può essere acceso, ma Vercel non ha un battito recente — non lo mostriamo come Online.`,
    );
  }
  if (rt === "OFFLINE" && !mirrorStale) {
    blockers.push("Runtime offline — il worker sul PC non pubblica un battito fresco.");
  }
  if (engine === "OFFLINE") blockers.push("Motore predittivo offline.");
  if (coverage?.source === "memory") {
    blockers.push("Copertura: registro in memoria (nessun report Lab B su questo host).");
  }
  if (noEvents) {
    blockers.push(
      String(
        analysis?.no_events_reason ??
          "Nessuna partita sul board. Niente di inventato.",
      ),
    );
  } else if (!predictionRows.some((e) => hasLivePrediction(e))) {
    blockers.push("Ci sono eventi, ma nessuna riga ha ancora una probabilità di modello indipendente.");
  }

  const noPredictionReason =
    predictionRows.length === 0
      ? noEvents
        ? String(
            analysis?.no_events_reason ??
              "Nessuna partita disponibile — ultimo ciclo senza righe sul board.",
          )
        : nextEvents.length === 0 && calendarEvents.length === 0
          ? "Nessuna partita in elenco per oggi. Niente di inventato."
          : "Elenco eventi vuoto per questa finestra."
      : "Le partite ci sono, ma senza previsione indipendente e senza quote osservate.";

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
          <p className="text-sm text-[var(--bm-danger)]">Errore snapshot: {error}</p>
        </Card>
      )}

      <section className="bm-hero">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="bm-section-label">Stato</div>
          <div className="flex flex-wrap gap-2">
            <StatusPill state={strip.webApp} label={`App ${statusWordIt(strip.webApp)}`} />
            <StatusPill state={rt} label={`Runtime ${statusWordIt(rt)}`} />
            <StatusPill state={engine} label={`Motore ${statusWordIt(engine)}`} />
            <Pill>Cervello {statusWordIt(strip.brain)}</Pill>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="bm-section-label">Oggi</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Previsioni</h2>
            <p className="mt-1 text-xs bm-muted">
              Modello indipendente e quote book restano strati separati. Le quote non entrano nel modello.
            </p>
          </div>
          <Link href="/events" className="text-xs bm-accent underline">
            Tutti gli eventi
          </Link>
        </div>
        {predictionRows.length === 0 ? (
          <EmptyState title="Nessuna previsione in elenco" reason={noPredictionReason} />
        ) : (
          <div className="grid gap-3">
            {predictionRows.map((ev) => (
              <PredictionOddsCard
                key={String(ev.event_id)}
                event={ev}
                href={typeof ev.event_id === "string" ? `/events/${ev.event_id}` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <div className="bm-ops">
        <details>
          <summary>Contatori operativi e resa dati</summary>
          <div className="bm-status-grid mt-4">
            {statusRows.map((s) => (
              <div key={s.name} className="bm-status-cell">
                <div className="bm-section-label">{s.name}</div>
                <strong className="inline-flex items-center gap-1.5">
                  <StatusDot state={s.state} />
                  {statusWordIt(s.state)}
                </strong>
                <p className="mt-1 truncate text-[11px] bm-muted">{s.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>Ultimo ciclo #{cycleNum != null ? String(cycleNum) : "—"}</Pill>
            <Pill>{fmtWhen(lastCycle)}</Pill>
            <Pill>{String(modelName)}</Pill>
          </div>
          {noEvents ? (
            <EmptyState
              title="NESSUN EVENTO DISPONIBILE"
              reason={String(
                analysis?.no_events_reason ??
                  `Fase ${phase}. Ultimo ciclo ${fmtWhen(lastCycle)}. Niente di inventato.`,
              )}
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label="Ultimo ciclo"
                value={cycleNum != null ? `#${String(cycleNum)}` : "—"}
                accent
              />
              <Metric label="Ultimo aggiornamento" value={fmtWhen(lastCycle)} />
              <Metric
                label="Eventi scoperti"
                value={String(
                  (analysis as { events_discovered?: number } | null)?.events_discovered ??
                    analysis?.events_in_store ??
                    "—",
                )}
              />
              <Metric
                label="Eventi in coda ricerca"
                value={String((analysis as { events_queued?: number } | null)?.events_queued ?? "—")}
              />
              <Metric
                label="Eventi ricercati"
                value={String(
                  (analysis as { events_researched?: number } | null)?.events_researched ??
                    (analysis as { events_with_research?: number } | null)?.events_with_research ??
                    "—",
                )}
              />
              <Metric
                label="Eventi eleggibili"
                value={String((analysis as { events_eligible?: number } | null)?.events_eligible ?? "—")}
              />
              <Metric
                label="Previsioni indipendenti"
                value={String((analysis as { model_inferences?: number } | null)?.model_inferences ?? "—")}
              />
              <Metric label="Previsioni prodotte" value={String(predictionsProduced ?? "—")} />
              <Metric
                label="Dati insufficienti"
                value={String((analysis as { insufficient_data?: number } | null)?.insufficient_data ?? "—")}
              />
              <Metric
                label="Fonti interrogate oggi"
                value={String(
                  (analysis as { sources_attempted_today?: number } | null)?.sources_attempted_today ?? "—",
                )}
              />
              <Metric
                label="Dati acquisiti oggi"
                value={String((analysis as { data_acquired_today?: number } | null)?.data_acquired_today ?? "—")}
              />
              <Metric
                label="Eventi con dati reali"
                value={String(
                  (analysis as { events_with_real_event_data?: number } | null)?.events_with_real_event_data ??
                    "—",
                )}
              />
              <Metric
                label="Eventi con archivio storico"
                value={String(
                  (analysis as { events_with_historical_data?: number } | null)?.events_with_historical_data ??
                    "—",
                )}
              />
              <Metric
                label="Osservazioni reali"
                value={String((analysis as { real_observations?: number } | null)?.real_observations ?? "—")}
              />
              <Metric
                label="Osservazioni storiche"
                value={String(
                  (analysis as { historical_observations?: number } | null)?.historical_observations ?? "—",
                )}
              />
              <Metric
                label="Feature derivate"
                value={String((analysis as { derived_observations?: number } | null)?.derived_observations ?? "—")}
              />
              <Metric
                label="Resa dati (osservazioni/tentativi)"
                value={String((analysis as { data_yield?: number } | null)?.data_yield ?? "—")}
              />
              <Metric
                label="Fonti bloccate oggi"
                value={String(
                  (analysis as { sources_blocked_today?: number } | null)?.sources_blocked_today ?? "—",
                )}
              />
              <Metric
                label="Fonti senza adapter oggi"
                value={String(
                  (analysis as { sources_missing_adapter_today?: number } | null)?.sources_missing_adapter_today ??
                    "—",
                )}
              />
              <Metric label="Saltati" value={String(analysis?.skipped ?? "—")} />
              <Metric
                label="Previsioni persistite (eventi ≠ inference)"
                value={String(
                  (analysis as { predictions_persisted_events?: number } | null)?.predictions_persisted_events ??
                    eventsAnalyzed ??
                    "—",
                )}
              />
              <Metric label="Board decisioni (finestra)" value={String(boardCount)} />
              <Metric label="Nota" value={String(activity?.note ?? analysis?.reason ?? "—")} />
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
          )}
        </details>
      </div>

      <Card title="Blocchi" glow={blockers.length > 0}>
        {blockers.length === 0 ? (
          <p className="text-sm bm-muted">Nessun blocco segnalato da questo snapshot.</p>
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
            Fonti
          </Link>
          <Link href="/models" className="bm-btn bm-btn-ghost text-xs">
            Modelli
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Bankroll simulato">
          <div className="text-3xl font-bold tracking-tight">
            {capital != null ? fmtMoney(capital) : "—"}
          </div>
          <div className="mt-1 text-xs bm-muted">
            {capital != null
              ? "Dal report carta · REAL_MONEY=false"
              : "Nessun report bankroll su questo host"}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="P&L" value={fmtMoney(paper?.profit_flat as number | undefined)} />
            <Metric label="ROI" value={fmtPct(paper?.roi_flat as number | undefined)} />
            <Metric label="Drawdown" value={fmtPct(paper?.max_drawdown_flat as number | undefined)} />
            <Metric label="Settled bets" value={String(paper?.n_settled ?? paper?.bets ?? "—")} />
          </div>
        </Card>

        <Card title="Metriche holdout (se presenti)">
          {independent ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Log Loss" value={fmtN(independent.log_loss as number)} />
              <Metric label="Brier" value={fmtN(independent.brier as number)} />
              <Metric label="Accuracy" value={fmtPct(independent.accuracy as number)} />
              <Metric label="vs Market LL" value={market ? fmtN(market.log_loss as number) : "—"} />
            </div>
          ) : (
            <EmptyState
              title="Nessuna metrica holdout su disco"
              reason="validation-report / holdout non è presente su questo host."
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
              title="Nessun caso liquidato"
              reason="learning_cases è vuoto — il ciclo di apprendimento non ha ancora casi."
            />
          )}
        </Card>
        <Card title="Settlement">
          {settlements.length === 0 ? (
            <EmptyState
              title="Nessun caso liquidato"
              reason="recent_settlements è vuoto — niente di inventato."
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
