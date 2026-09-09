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
  asRecord,
  edgeLabel,
  fmtN,
  fmtPct,
  fmtWhen,
} from "@/components/betmind/ui";
import { useBmLocale } from "@/components/betmind/useBmLocale";

type DossierFeature = {
  name: string;
  value: number | string | null;
  source: string;
  observed_at: string | null;
  available_at: string | null;
  status: string;
  entered_model: boolean;
};

type DossierResearch = {
  source_id: string;
  fetched: boolean;
  ok: boolean;
  phase: string;
  fetched_at: string | null;
  available_at: string | null;
  reason: string | null;
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Detail;
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
  const modelProbs = dossier?.independent_model.probability ?? pred?.probability_model;
  const marketProbs = dossier?.market.probability ?? pred?.probability_market;
  const edgeStatus = data?.decision_048?.edge_status ?? "UNKNOWN";
  const cycleN = dossier?.cycle.cycle_number;
  const modelVer =
    dossier?.independent_model.model_version ??
    dossier?.cycle.model_version ??
    data?.model_version ??
    pred?.model_version ??
    "—";

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
            <h1 className="mt-2 text-2xl font-bold leading-tight">
              {data.event.home_or_a}
              <span className="mx-2 text-base bm-muted">{t.vs}</span>
              {data.event.away_or_b}
            </h1>
            <p className="mt-2 text-sm bm-muted">
              {data.event.sport} · {t.kickoff} {fmtWhen(String(data.event.kickoff_utc ?? ""))} ·{" "}
              {data.event.status ?? data.event.semantic_level}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Pill accent>{modelVer}</Pill>
              <Pill>
                {t.cycle_n} #{cycleN != null ? String(cycleN) : "—"}
              </Pill>
              <Pill>{t.event_id}: {data.event.event_id.slice(0, 12)}…</Pill>
              <Pill>{data.decision_048?.decision ?? "—"}</Pill>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card title={t.independent_model} glow>
              <p className="mb-2 text-xs bm-muted">
                Probabilità del modello indipendente — senza quote.
              </p>
              {modelProbs ? (
                <ul className="space-y-1 text-sm">
                  <li className="flex justify-between">
                    <span>{t.home}</span>
                    <span className="bm-accent">{fmtPct(modelProbs.HOME ?? modelProbs.home)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t.draw}</span>
                    <span className="bm-accent">{fmtPct(modelProbs.DRAW ?? modelProbs.draw)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t.away}</span>
                    <span className="bm-accent">{fmtPct(modelProbs.AWAY ?? modelProbs.away)}</span>
                  </li>
                </ul>
              ) : (
                <EmptyState
                  title={t.no_data}
                  reason={
                    dossier?.independent_model.note ??
                    "probability_model assente per questo evento"
                  }
                />
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Metric label={t.model_version} value={String(modelVer)} />
                <Metric
                  label={t.confidence}
                  value={fmtN(
                    dossier?.independent_model.confidence ?? pred?.confidence_score,
                    2,
                  )}
                />
                <Metric
                  label={t.feature_coverage}
                  value={
                    dossier?.independent_model.feature_coverage != null
                      ? fmtPct(dossier.independent_model.feature_coverage)
                      : "—"
                  }
                />
                <Metric label={t.analyzed_at} value={fmtWhen(String(dossier?.analyzed_at ?? ""))} />
              </div>
            </Card>

            <Card title={t.market}>
              <p className="mb-2 text-xs bm-muted">
                {dossier?.market.note ??
                  "Solo confronto — le quote non entrano nel modello indipendente."}
              </p>
              {marketProbs && Object.keys(marketProbs).length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {Object.entries(marketProbs).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span>{fmtPct(v)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Unknown label={`${t.no_data} — probabilità di mercato assenti`} />
              )}
              <div className="mt-3">
                <Metric
                  label={t.edge}
                  value={edgeLabel(edgeStatus, data.decision_048?.estimated_edge)}
                />
              </div>
            </Card>
          </div>

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
                      <th className="py-1">{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier!.features.map((f) => (
                      <tr key={`${f.name}-${f.source}`} className="border-t border-[var(--bm-border)]">
                        <td className="py-1.5 pr-2 font-medium">
                          {f.name}
                          {f.entered_model ? (
                            <span className="ml-1 text-[10px] bm-accent">→ modello</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-2">
                          {f.value == null ? "—" : String(f.value)}
                        </td>
                        <td className="py-1.5 pr-2">{f.source}</td>
                        <td className="py-1.5 pr-2">{fmtWhen(String(f.observed_at ?? ""))}</td>
                        <td className="py-1.5 pr-2">{fmtWhen(String(f.available_at ?? ""))}</td>
                        <td className="py-1.5">{statusIt(f.status, t)}</td>
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
                      <span className="bm-muted">
                        {r.fetched_at ? fmtWhen(r.fetched_at) : "—"}
                      </span>
                    </span>
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

          <Card title={t.settlement}>
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
