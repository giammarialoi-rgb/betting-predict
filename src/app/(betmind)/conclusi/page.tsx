"use client";

import Link from "next/link";
import { Card, SnapshotBadge, Metric, Pill, asRecord, fmtWhen } from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";

/**
 * /conclusi — real evaluation from settlements, not persisted predictions.
 */
export default function ConclusiPage() {
  const { data, error, updating, lastUpdate } = useBetMindData();
  const settlements = (data?.recent_settlements ?? []) as unknown[];
  const cases = data?.learning_cases ?? [];
  const analysis = asRecord((data as { analysis?: unknown } | null)?.analysis);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Valutazione</div>
          <h1 className="text-2xl font-bold">Conclusi</h1>
          <p className="mt-1 text-sm bm-muted">
            Solo partite con esito verificato. Una previsione persistita non e un risultato.
            Le quote restano fuori dal modello indipendente.
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Settlement">
          <Metric label="Esiti scritti" value={String(settlements.length)} />
        </Card>
        <Card title="Learning">
          <Metric label="Casi da settlement" value={String(cases.length)} />
        </Card>
        <Card title="Ciclo">
          <Metric label="Ultimo ciclo" value={analysis?.cycle_number != null ? String(analysis.cycle_number) : "—"} />
        </Card>
      </div>

      <Card title="Settlement reali" glow>
        <div className="space-y-3">
          {settlements.map((s, i) => {
            const row = asRecord(s);
            const id = String(row?.event_id ?? "");
            const home = String(row?.home ?? row?.home_or_a ?? "").trim();
            const away = String(row?.away ?? row?.away_or_b ?? "").trim();
            const score = [row?.home_goals ?? row?.fthg, row?.away_goals ?? row?.ftag]
              .filter((v) => v != null)
              .join("–");
            return (
              <div key={`${id}-${i}`} className="rounded-xl border border-[var(--bm-border)] bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill accent>SETTLEMENT</Pill>
                  <span className="text-xs bm-muted">{fmtWhen(String(row?.settled_at ?? row?.at ?? ""))}</span>
                </div>
                <h3 className="mt-2 text-base font-semibold">
                  {home || "—"} <span className="bm-muted font-normal">vs</span> {away || "—"}
                </h3>
                <p className="text-sm">
                  Esito: {score || String(row?.result ?? row?.ftr ?? "—")}
                </p>
                {id ? (
                  <Link href={`/events/${id}`} className="bm-btn bm-btn-ghost mt-3 text-xs">
                    Apri dossier
                  </Link>
                ) : null}
              </div>
            );
          })}
          {settlements.length === 0 && (
            <p className="text-sm bm-muted">
              Nessun settlement in store. Non inventiamo risultati. Vedi anche /learn per i casi di
              apprendimento quando esistono.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
