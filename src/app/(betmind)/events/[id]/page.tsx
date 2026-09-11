"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  SnapshotBadge,
  Metric,
  Pill,
  Unknown,
  EmptyState,
  edgeLabel,
  fmtN,
  fmtPct,
  fmtWhen,
} from "@/components/betmind/ui";
import { OddsBlock } from "@/components/betmind/OddsBlock";
import { useBmLocale } from "@/components/betmind/useBmLocale";
import { eventStatusIt, selectionLabelIt } from "@/domain/eval/betmind-runtime/status-copy";

type DossierFeature = {
  name: string;
  value: number | string | null;
  source: string;
  observed_at: string | null;
  available_at: string | null;
  status: string;
  entered_model: boolean;
  derived_from?: string[];
  calculation?: string | null;
};

type DossierResearch = {
  source_id: string;
  fetched: boolean;
  ok: boolean;
  phase: string;
  fetched_at: string | null;
  available_at: string | null;
  observed_at?: string | null;
  reason: string | null;
  url?: string | null;
  http_status?: number | null;
  parser_status?: string | null;
  fields_extracted?: string[];
  adapter_kind?: string | null;
};

type DossierLineage = {
  what_betmind_knew_before_kickoff: string;
  sources_consulted: string[];
  source_information: Array<{ source_id: string; summary: string }>;
  eligible_information: string[];
  features_entered_model: string[];
  model_version: string | null;
  prediction_produced: string;
  odds_entered_model: false;
  information_missing: string[];
  after_inference: string;
  feature_vector_schema: string[];
  edge_calculated: boolean;
  confidence_defined: boolean;
};

type Detail = {
  event: {
    event_id: string;
    sport: string;
    competition: string;
    home_or_a: string;
    away_or_b: string;
    kickoff_utc: string | null;
    semantic_level: string;
    status?: string;
  };
  predictions: {
    selection: string | null;
    confidence_score: number;
    human_readable_reason: string;
    probability_model: Record<string, number> | null;
    probability_market: Record<string, number> | null;
    model_version: string;
    reason_codes: string[];
    prediction_id?: string | null;
    timestamp?: string | null;
  }[];
  settlement: {
    result: string;
    outcome: string;
    settled_at: string;
  } | null;
  decision_048?: {
    decision: string;
    estimated_edge: number | null;
    edge_status?: string;
    confidence: number;
    stake?: number;
    model_pct?: number | null;
    market_pct?: number | null;
    explanation: {
      WHY_PRIMARY: string;
      WHY_SUPPORTING: string[];
      WHY_AGAINST: string[];
      WHY_RISK: string[];
      WHY_NO_BET: string | null;
    };
  } | null;
  dossier?: {
    cycle: {
      cycle_number: number | null;
      last_cycle_at: string | null;
      model_version: string | null;
    };
    independent_model: {
      probability: Record<string, number> | null;
      model_version: string | null;
      confidence: number | null;
      feature_coverage: number | null;
      note: string | null;
      reason_codes: string[];
    };
    market: {
      probability: Record<string, number> | null;
      note: string;
    };
    features: DossierFeature[];
    features_note: string | null;
    research: DossierResearch[];
    analyzed_at: string | null;
    prediction_persisted_at?: string | null;
    lineage?: DossierLineage | null;
    research_summary?: {
      sources_attempted: number;
      sources_successful: number;
      sources_partial: number;
      sources_blocked: number;
      sources_missing_adapter: number;
      sources_no_data: number;
      source_rows: Array<{
        source_id: string;
        title: string;
        human_status: string;
        fetched: boolean;
        http_status: number | null;
        fetched_at: string | null;
        fields_extracted?: string[];
        sought_it?: string;
        market_layer: boolean;
        reason_it: string;
        public_url: string | null;
      }>;
      feature_groups_found: string[];
      feature_groups_missing: string[];
      model_inputs: Array<{ key: string; label_it: string; value: number | string | null; quality: string }>;
      model_exclusions: Array<{ key: string; label_it: string; reason_it: string; quality: string }>;
      timeline: Array<{ at: string | null; label_it: string }>;
      prediction_snapshot: {
        feature_count_entered: number;
        feature_coverage: number | null;
        has_independent_inference: boolean;
        odds_entered_model: false;
        model_version: string | null;
      };
    } | null;
    human_explanation?: {
      match_line: string;
      did?: string;
      live_research?: string;
      archive?: string;
      prediction_lines: string[];
      why: string[];
      analyzed: string;
      used: string[];
      missing: string[];
      sources_summary: string;
      odds_sentence: string;
      model_card: {
        name_it: string;
        version: string;
        inputs: number;
        coverage_pct: string | null;
        odds_used: false;
      };
      how_model_works: string;
      poisson: string | null;
      insufficient: string | null;
      category_checks: Array<{ label: string; found: boolean; note: string }>;
      analyzed_topics?: Array<{ id: string; label_it: string; light: string; note_it: string }>;
      found?: string[];
    } | null;
    data_quality?: { data_quality_score: number; letter?: string; note_it: string } | null;
    conflicts?: Array<{ field: string; note_it: string; used_source: string | null }>;
    team_identity?: {
      home: {
        display_name: string;
        canonical_id: string;
        matched: boolean;
        provisional?: boolean;
        provider_ids?: Record<string, string | null>;
      };
      away: {
        display_name: string;
        canonical_id: string;
        matched: boolean;
        provisional?: boolean;
        provider_ids?: Record<string, string | null>;
      };
      division: string | null;
    } | null;
    poisson?: { lambda_home: number; lambda_away: number } | null;
    reconciliation?: Array<{ field: string; label_it: string; status: string; note_it: string }>;
  } | null;
  model_version: string | null;
  finished?: boolean;
  api_calls_ui: 0;
};

function statusIt(s: string, t: ReturnType<typeof useBmLocale>["t"]): string {
  switch (s) {
    case "ELIGIBLE":
      return t.status_eligible;
    case "UNAVAILABLE":
      return t.status_unavailable;
    case "STALE":
      return t.status_stale;
    case "INVALID":
      return t.status_invalid;
    case "INSUFFICIENT":
      return t.status_insufficient;
    default:
      return s;
  }
}

export default function EventDetailPage() {
  const { t } = useBmLocale();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setUpdating(true);
      try {
        const res = await fetch(`/api/betmind/event/${params.id}`, { cache: "no-store" });
        const json = (await res.json()) as Detail & {
          error?: string;
          reason?: string;
          present?: Record<string, unknown>;
          missing?: string[];
          board_summary?: Record<string, unknown>;
        };
        if (!res.ok) {
          const parts = [
            json.reason ?? `HTTP ${res.status}`,
            json.error ? `(${json.error})` : null,
            Array.isArray(json.missing) && json.missing.length
              ? `Missing: ${json.missing.join(", ")}`
              : null,
          ].filter(Boolean);
          throw new Error(parts.join(" — "));
        }
        if (alive) {
          setData(json);
          setErr(null);
          setLastUpdate(new Date().toISOString());
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "fetch fallito");
      } finally {
        if (alive) setUpdating(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [params.id]);

  const pred = data?.predictions?.[0];
  const dossier = data?.dossier;
  const hx = dossier?.human_explanation ?? null;
  const rs = dossier?.research_summary ?? null;
  const modelProbs = dossier?.independent_model.probability ?? null;
  const marketProbs = dossier?.market.probability ?? pred?.probability_market;
  const edgeStatus = data?.decision_048?.edge_status ?? "UNKNOWN";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/events" className="text-sm bm-muted underline">
          {t.back_to_events}
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <SnapshotBadge updating={updating} />
          <span className="bm-muted">
            {lastUpdate ? new Date(lastUpdate).toLocaleTimeString("it-IT") : "—"}
          </span>
        </div>
      </div>

      {err && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{err}</p>
        </Card>
      )}
      {!data && !err && (
        <Card>
          <Unknown label={t.loading} />
        </Card>
      )}

      {data && (
        <>
          <header className="bm-hero text-center">
            <div className="bm-section-label">{data.event.competition}</div>
            <h1 className="mt-2 text-3xl font-bold leading-tight">
              {data.event.home_or_a}
              <div className="my-1 text-base font-medium bm-muted">{t.vs}</div>
              {data.event.away_or_b}
            </h1>
            <p className="mt-2 text-sm bm-muted">
              {fmtWhen(String(data.event.kickoff_utc ?? ""))}
              {data.event.status ? ` · ${eventStatusIt(data.event.status)}` : ""}
            </p>
          </header>

          <Card title="Previsione BetMind" glow>
            {hx?.insufficient ? (
              <p className="text-sm leading-relaxed">{hx.insufficient}</p>
            ) : modelProbs ? (
              <ul className="space-y-2 text-lg">
                <li className="flex justify-between">
                  <span>Casa</span>
                  <span className="font-semibold bm-accent">{fmtPct(modelProbs.HOME ?? modelProbs.home)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Pareggio</span>
                  <span className="font-semibold bm-accent">{fmtPct(modelProbs.DRAW ?? modelProbs.draw)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Trasferta</span>
                  <span className="font-semibold bm-accent">{fmtPct(modelProbs.AWAY ?? modelProbs.away)}</span>
                </li>
              </ul>
            ) : (
              <EmptyState
                title="Nessuna previsione indipendente"
                reason={
                  hx?.insufficient ??
                  dossier?.independent_model.note ??
                  "I dati disponibili non hanno raggiunto i requisiti del modello."
                }
              />
            )}
            {hx?.model_card && (
              <p className="mt-3 text-sm bm-muted">
                Modello statistico indipendente · {hx.model_card.name_it}
                {hx.model_card.coverage_pct ? ` · copertura dei dati ${hx.model_card.coverage_pct}` : ""}
                {hx.model_card.inputs ? ` · ${hx.model_card.inputs} informazioni usate` : ""}
              </p>
            )}
            {hx?.poisson && <p className="mt-2 text-sm">{hx.poisson}</p>}
          </Card>

          {hx && (
            <Card title="Cosa ha fatto BetMind">
              <p className="mb-2 text-sm leading-relaxed">{hx.did}</p>
              {hx.live_research ? <p className="mb-1 text-sm">{hx.live_research}</p> : null}
              {hx.archive ? <p className="text-sm">{hx.archive}</p> : null}
            </Card>
          )}

          {dossier?.team_identity && (
            <Card title="Identità dell'evento">
              <p className="mb-2 text-sm">
                {dossier.team_identity.home.display_name}:{" "}
                <code className="text-xs">{dossier.team_identity.home.canonical_id}</code>
                {dossier.team_identity.home.provisional ? " (provvisoria)" : ""}
                {dossier.team_identity.home.matched ? "" : " — non abbinata all'archivio"}
              </p>
              <p className="mb-2 text-sm">
                {dossier.team_identity.away.display_name}:{" "}
                <code className="text-xs">{dossier.team_identity.away.canonical_id}</code>
                {dossier.team_identity.away.provisional ? " (provvisoria)" : ""}
                {dossier.team_identity.away.matched ? "" : " — non abbinata all'archivio"}
              </p>
              <p className="text-xs bm-muted">
                Division: {dossier.team_identity.division ?? "non risolta"}. ID SofaScore / API-Sports /
                FBref / Understat / WhoScored: non inventati (null finché non sono realmente noti).
              </p>
            </Card>
          )}

          {dossier?.conflicts && dossier.conflicts.length > 0 && (
            <Card title="Conflitti tra fonti">
              <ul className="space-y-2 text-sm">
                {dossier.conflicts.map((c) => (
                  <li key={c.field}>
                    <span className="font-medium">{c.field}</span>
                    <p className="bm-muted">{c.note_it}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {dossier?.reconciliation && dossier.reconciliation.length > 0 && (
            <Card title="Riconciliazione tra fonti">
              <ul className="space-y-2 text-sm">
                {dossier.reconciliation.map((row) => (
                  <li key={row.field}>
                    <span className="font-medium">{row.label_it}</span>{" "}
                    <span className="text-xs bm-muted">{row.status}</span>
                    <p className="bm-muted">{row.note_it}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {hx && (
            <Card title="Perché">
              {hx.why.map((line) => (
                <p key={line} className="mb-2 text-sm leading-relaxed">
                  {line}
                </p>
              ))}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer bm-muted">Come funziona il modello?</summary>
                <p className="mt-2 leading-relaxed">{hx.how_model_works}</p>
              </details>
            </Card>
          )}

          {hx && (
            <Card title="Cosa abbiamo trovato">
              {(hx.found ?? []).length === 0 ? (
                <p className="text-sm bm-muted">Nessuna osservazione persistita per questa partita.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {(hx.found ?? []).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {hx && (
            <Card title="Cosa ha analizzato BetMind">
              <p className="mb-3 text-sm leading-relaxed">{hx.analyzed}</p>
              {dossier?.data_quality ? (
                <p className="mb-3 text-xs bm-muted">
                  Qualita dati {dossier.data_quality.letter ?? "—"}{" "}
                  ({Math.round(dossier.data_quality.data_quality_score * 100)}%) — {dossier.data_quality.note_it}
                </p>
              ) : null}
              <ul className="space-y-1 text-sm">
                {(hx.analyzed_topics ?? hx.category_checks.map((c) => ({
                  id: c.label,
                  label_it: c.label,
                  light: c.found ? "USED" : "MISSING",
                  note_it: c.note,
                }))).map((c) => {
                  const glyph =
                    c.light === "USED" ? "🟢" : c.light === "PARTIAL" ? "🟡" : c.light === "TEMPORAL" ? "🔴" : "⚪";
                  const bar =
                    c.light === "USED"
                      ? "██████████"
                      : c.light === "PARTIAL"
                        ? "██████"
                        : c.light === "TEMPORAL"
                          ? "████"
                          : "██";
                  const stato =
                    c.light === "USED"
                      ? "Trovato"
                      : c.light === "PARTIAL"
                        ? "Parzialmente trovato"
                        : c.light === "TEMPORAL"
                          ? "Escluso temporalmente"
                          : "Non disponibile";
                  return (
                    <li key={c.id}>
                      {glyph} {c.label_it} {bar}
                      <span className="bm-muted"> — {stato}. {c.note_it}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {hx && (
            <Card title="Informazioni utilizzate">
              {hx.used.length === 0 ? (
                <p className="text-sm bm-muted">Nessuna informazione è entrata nel modello indipendente.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {hx.used.map((u) => (
                    <li key={u}>• {u}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {hx && (
            <Card title="Cosa non è riuscito a trovare">
              {hx.missing.length === 0 ? (
                <p className="text-sm bm-muted">Nessuna lacuna aggiuntiva registrata oltre al catalogo tecnico.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {hx.missing.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {rs && (
            <Card title="Fonti consultate">
              <p className="mb-3 text-sm leading-relaxed">{hx?.sources_summary}</p>
              <ul className="space-y-3 text-sm">
                {rs.source_rows.map((r) => (
                  <li key={r.source_id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{r.title}</span>
                      <span className="text-xs bm-muted">
                        {r.human_status === "SUCCESS"
                          ? "ha restituito dati"
                          : r.human_status === "PARTIAL"
                            ? "parziale"
                        : r.human_status === "BLOCKED" || r.human_status === "HTTP_ERROR"
                          ? "non raggiungibile"
                          : r.human_status === "NO_DATA" || r.human_status === "NO_EVENT"
                            ? "nessuna info su questa partita"
                          : r.human_status === "AUTH_REQUIRED"
                            ? "autenticazione richiesta"
                          : r.human_status === "RATE_LIMITED"
                            ? "limite di richieste"
                          : r.human_status === "POST_KICKOFF"
                            ? "dopo kickoff (esclusa)"
                          : r.human_status === "PARSE_ERROR"
                            ? "risposta non interpretabile"
                          : "nessuna info su questa partita"}
                      </span>
                    </div>
                    <p className="text-xs bm-muted">
                      Cercava: {r.sought_it ?? "dati evento"}. Trovato:{" "}
                      {(r.fields_extracted ?? []).length
                        ? r.fields_extracted!.join(", ")
                        : "nessun campo evento-specifico"}
                      {r.fetched_at ? ` · ${fmtWhen(r.fetched_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {rs && rs.timeline.length > 0 && (
            <Card title="Cronologia della ricerca">
              <ul className="space-y-2 text-sm">
                {rs.timeline.map((row) => (
                  <li key={`${row.at}-${row.label_it}`}>
                    <span className="bm-muted">{row.at ? fmtWhen(row.at) : "—"}</span>
                    <span className="ml-2">{row.label_it}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="Modello indipendente">
              <p className="mb-2 text-sm">
                {hx?.odds_sentence ??
                  "Il modello non ha utilizzato le quote per calcolare queste probabilità."}
              </p>
              {hx?.model_card && (
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Modello" value={hx.model_card.name_it} />
                  <Metric label="Versione" value={hx.model_card.version} />
                  <Metric label="Informazioni usate" value={String(hx.model_card.inputs)} />
                  <Metric label="Copertura dei dati" value={hx.model_card.coverage_pct ?? "—"} />
                </div>
              )}
            </Card>

            <Card title="Mercato — separato">
              <p className="mb-2 text-sm bm-muted">
                {dossier?.market.note ??
                  "Solo confronto — le quote non entrano nel modello indipendente."}
              </p>
              <OddsBlock event={(data.event ?? {}) as Record<string, unknown>} />
              {marketProbs && Object.keys(marketProbs).length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {Object.entries(marketProbs).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>{selectionLabelIt(k)}</span>
                      <span>{fmtPct(v)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm bm-muted">Probabilità di mercato assenti. Niente di inventato.</p>
              )}
              <div className="mt-3">
                <Metric
                  label={t.edge}
                  value={edgeLabel(edgeStatus, data.decision_048?.estimated_edge)}
                />
              </div>
            </Card>
          </div>

          <details className="rounded-xl border border-[var(--bm-border)] bg-[var(--bm-card)] p-4">
            <summary className="cursor-pointer text-sm font-semibold">Dettagli tecnici</summary>
            <div className="mt-4 flex flex-col gap-4">
          {dossier?.lineage && (
            <Card title={t.lineage_title} glow>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs bm-muted">Cosa sapeva BetMind prima del calcio d’inizio?</dt>
                  <dd className="mt-1">{dossier.lineage.what_betmind_knew_before_kickoff}</dd>
                </div>
                <div>
                  <dt className="text-xs bm-muted">Fonti consultate</dt>
                  <dd className="mt-1">
                    {dossier.lineage.sources_consulted.length
                      ? dossier.lineage.sources_consulted.join(", ")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs bm-muted">Feature entrate nel modello</dt>
                  <dd className="mt-1">
                    {dossier.lineage.features_entered_model.length
                      ? dossier.lineage.features_entered_model.join(", ")
                      : "nessuna"}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label={t.model_version}
                    value={String(dossier.lineage.model_version ?? "—")}
                  />
                  <Metric
                    label={t.odds_in_model}
                    value={dossier.lineage.odds_entered_model ? "SÌ" : "NO"}
                  />
                  <Metric
                    label="EDGE calcolato"
                    value={dossier.lineage.edge_calculated ? "sì" : "no"}
                  />
                  <Metric
                    label="Confidence definita"
                    value={dossier.lineage.confidence_defined ? "sì" : "no"}
                  />
                </div>
                <div>
                  <dt className="text-xs bm-muted">Previsione prodotta</dt>
                  <dd className="mt-1 break-words text-xs">{dossier.lineage.prediction_produced}</dd>
                </div>
                <div>
                  <dt className="text-xs bm-muted">Dopo l’inference</dt>
                  <dd className="mt-1">{dossier.lineage.after_inference}</dd>
                </div>
                <div>
                  <dt className="text-xs bm-muted">Informazioni mancanti (prime)</dt>
                  <dd className="mt-1 text-xs bm-muted">
                    {dossier.lineage.information_missing.slice(0, 12).join(" · ") || "—"}
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          <Card title={t.model_input_features}>
            {dossier?.features_note && (
              <p className="mb-3 text-sm bm-muted">{dossier.features_note}</p>
            )}
            {(dossier?.features?.length ?? 0) === 0 ? (
              <EmptyState title={t.no_data} reason="Nessuna feature nel reasoning snapshot." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bm-muted">
                    <tr>
                      <th className="py-1 pr-2">{t.feature_name}</th>
                      <th className="py-1 pr-2">{t.feature_value}</th>
                      <th className="py-1 pr-2">{t.feature_source}</th>
                      <th className="py-1 pr-2">{t.observed_at}</th>
                      <th className="py-1 pr-2">{t.available_at}</th>
                      <th className="py-1 pr-2">{t.status}</th>
                      <th className="py-1">{t.entered_model}</th>
                      <th className="py-1">derived_from</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier!.features.map((f) => (
                      <tr key={`${f.name}-${f.source}`} className="border-t border-[var(--bm-border)]">
                        <td className="py-1.5 pr-2 font-medium">{f.name}</td>
                        <td className="py-1.5 pr-2">
                          {f.value == null ? "—" : String(f.value)}
                        </td>
                        <td className="py-1.5 pr-2">{f.source}</td>
                        <td className="py-1.5 pr-2">{fmtWhen(String(f.observed_at ?? ""))}</td>
                        <td className="py-1.5 pr-2">{fmtWhen(String(f.available_at ?? ""))}</td>
                        <td className="py-1.5 pr-2">{statusIt(f.status, t)}</td>
                        <td className="py-1.5">{f.entered_model ? "sì" : "no"}</td>
                        <td className="py-1.5 text-[10px] bm-muted">
                          {(f.derived_from ?? []).slice(0, 5).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={t.research}>
            <p className="mb-3 text-xs bm-muted">{t.research_note}</p>
            {(dossier?.research?.length ?? 0) === 0 ? (
              <EmptyState
                title={t.no_data}
                reason="Nessuno stato ricerca ancora scritto per questo evento."
              />
            ) : (
              <ul className="space-y-2 text-sm">
                {dossier!.research.map((r) => (
                  <li
                    key={r.source_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--bm-border)] px-3 py-2"
                  >
                    <span className="font-medium">{r.source_id}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {r.fetched ? (
                        <span className="bm-accent">✓ {t.fetched}</span>
                      ) : (
                        <span className="text-[var(--bm-warn)]">⚠ {t.unavailable}</span>
                      )}
                      <span className="bm-muted">{r.phase}</span>
                      {r.http_status != null && (
                        <span className="bm-muted">HTTP {r.http_status}</span>
                      )}
                      <span className="bm-muted">
                        {r.fetched_at ? fmtWhen(r.fetched_at) : "—"}
                      </span>
                    </span>
                    {r.adapter_kind && (
                      <p className="w-full text-[11px] bm-muted">adapter={r.adapter_kind}</p>
                    )}
                    {r.fields_extracted && r.fields_extracted.length > 0 && (
                      <p className="w-full text-[11px] bm-muted">
                        fields: {r.fields_extracted.join(", ")}
                      </p>
                    )}
                    {r.reason && (
                      <p className="w-full text-[11px] bm-muted">{r.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t.decision}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label={t.decision} value={data.decision_048?.decision ?? "—"} accent />
              <Metric
                label={t.edge}
                value={edgeLabel(edgeStatus, data.decision_048?.estimated_edge)}
              />
              <Metric label={t.confidence} value={fmtN(data.decision_048?.confidence, 2)} />
              <Metric
                label="Puntata (paper)"
                value={String(data.decision_048?.stake ?? "—")}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              {data.decision_048?.explanation.WHY_PRIMARY ??
                pred?.human_readable_reason ??
                t.no_data}
            </p>
            {(pred?.reason_codes?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {pred!.reason_codes.map((c) => (
                  <Pill key={c}>{c}</Pill>
                ))}
              </div>
            )}
          </Card>
            </div>
          </details>

          <Card title="Esito">
            {data.settlement ? (
              <div className="space-y-1 text-sm">
                <div>
                  {t.result}: {data.settlement.result}
                </div>
                <div>Esito: {data.settlement.outcome}</div>
                <div className="bm-muted text-xs">{data.settlement.settled_at}</div>
              </div>
            ) : (
              <p className="text-sm bm-muted">{t.no_settled_cases}</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
