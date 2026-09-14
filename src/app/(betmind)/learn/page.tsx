"use client";

import Link from "next/link";
import {
  Card,
  SnapshotBadge,
  Metric,
  Pill,
  EmptyState,
  asRecord,
  fmtN,
  fmtWhen,
} from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";
import { useBmLocale } from "@/components/betmind/useBmLocale";

function pct(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const p = v <= 1 ? v * 100 : v;
  return `${fmtN(p, 0)}%`;
}

export default function LearnPage() {
  const { t } = useBmLocale();
  const { data, error, updating, lastUpdate } = useBetMindData();
  const cases = data?.learning_cases ?? [];
  const report = asRecord(data?.predictive?.learning_report);
  const validation = asRecord(data?.predictive?.validation);
  const metrics = asRecord(asRecord(validation?.holdout)?.metrics) ?? asRecord(validation);
  const independent = asRecord(metrics?.independent);
  const market = asRecord(metrics?.market);
  const analysis =
    asRecord((data as { analysis?: unknown } | null)?.analysis) ??
    asRecord(asRecord(data?.observatory)?.analysis);
  const categories = new Map<string, number>();
  const versions = new Map<string, number>();
  for (const c of cases) {
    const row = asRecord(c);
    const cat = String(row?.category ?? row?.result_class ?? "SCONOSCIUTO");
    categories.set(cat, (categories.get(cat) ?? 0) + 1);
    const mv = String(
      row?.model_version ?? asRecord(row?.prediction)?.model_version ?? analysis?.model_version ?? "—",
    );
    versions.set(mv, (versions.get(mv) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">{t.learning}</div>
          <h1 className="text-2xl font-bold">{t.learn_title}</h1>
          <p className="mt-1 text-sm bm-muted">{t.learn_subtitle}</p>
          <p className="mt-2 text-xs bm-muted">
            Una previsione persistita non è un esito. L&apos;inference indipendente è distinta
            dalla riga salvata. I casi sotto appaiono solo quando l&apos;esito è stato verificato —
            le partite future restano in attesa.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SnapshotBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString("it-IT") : "—"}</span>
        </div>
      </div>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title={t.performance_over_time}>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Log Loss" value={independent ? fmtN(independent.log_loss as number) : t.unknown} />
            <Metric label="Brier" value={independent ? fmtN(independent.brier as number) : t.unknown} />
            <Metric label="Accuratezza" value={independent ? fmtN(independent.accuracy as number) : t.unknown} />
            <Metric label="Log Loss mercato" value={market ? fmtN(market.log_loss as number) : "—"} />
          </div>
        </Card>
        <Card title={t.error_categories}>
          {categories.size === 0 ? (
            <p className="text-sm bm-muted">{t.no_settled_cases}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...categories.entries()].map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span>{k}</span>
                  <span className="bm-accent">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t.model_versions}>
        {versions.size === 0 ? (
          <p className="text-sm bm-muted">{t.no_settled_cases}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...versions.entries()].map(([k, v]) => (
              <Pill key={k} accent>
                {k} · {v}
              </Pill>
            ))}
          </div>
        )}
      </Card>

      {report && (
        <Card title={t.learning_report}>
          <pre className="max-h-40 overflow-auto text-[11px] text-[var(--bm-muted)]">
            {JSON.stringify(report, null, 2).slice(0, 1800)}
          </pre>
        </Card>
      )}

      <Card title={t.recent_lessons} glow>
        <div className="space-y-3">
          {cases.map((c, i) => {
            const row = asRecord(c);
            const id = String(row?.event_id ?? "");
            const pred = asRecord(row?.prediction);
            const home = String(row?.home ?? "").trim();
            const away = String(row?.away ?? "").trim();
            const hasIdentity = Boolean(home && away && id);
            const cycle = row?.cycle_number ?? analysis?.cycle_number;
            const model = String(
              row?.model_version ?? pred?.model_version ?? analysis?.model_version ?? "—",
            );

            if (!hasIdentity) {
              return (
                <div key={`anon-${i}`} className="rounded-xl border border-[var(--bm-border)] bg-black/20 p-3">
                  <EmptyState
                    title={t.no_event_identity}
                    reason="Caso di apprendimento senza squadre/event_id — nessuna probabilità orfana mostrata."
                  />
                </div>
              );
            }

            return (
              <div key={`${id}-${i}`} className="rounded-xl border border-[var(--bm-border)] bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill accent>{String(row?.category ?? "CASO")}</Pill>
                  <Pill>{String(row?.stake_outcome ?? "—")}</Pill>
                  <span className="text-xs bm-muted">{fmtWhen(String(row?.created_at ?? ""))}</span>
                </div>
                <h3 className="mt-2 text-base font-semibold">
                  {home} <span className="bm-muted font-normal">{t.vs}</span> {away}
                </h3>
                <p className="text-xs bm-muted">
                  {String(row?.competition ?? "—")} · {t.kickoff}{" "}
                  {fmtWhen(String(row?.kickoff_utc ?? ""))}
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <div className="bm-metric-label">{t.prediction}</div>
                    {pred ? (
                      <div className="mt-1 space-y-0.5">
                        <div>
                          {t.home} {pct(pred.HOME)}
                        </div>
                        <div>
                          {t.draw} {pct(pred.DRAW)}
                        </div>
                        <div>
                          {t.away} {pct(pred.AWAY)}
                        </div>
                      </div>
                    ) : (
                      <div className="bm-muted">{t.no_data}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="bm-metric-label">{t.model}</div>
                      <div>{model}</div>
                    </div>
                    <div>
                      <div className="bm-metric-label">{t.analysis}</div>
                      <div>
                        {t.cycle_n} #{cycle != null ? String(cycle) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="bm-metric-label">{t.result}</div>
                      <div>{String(row?.actual ?? row?.result ?? "—")}</div>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs bm-muted">
                  {t.lesson}: {String(row?.calibration_note ?? row?.decision_correctness ?? "—")}
                </p>
                <Link href={`/events/${id}`} className="bm-btn bm-btn-ghost mt-3 text-xs">
                  {t.open_analysis}
                </Link>
              </div>
            );
          })}
          {cases.length === 0 && (
            <p className="text-sm bm-muted">{t.no_settled_cases}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
