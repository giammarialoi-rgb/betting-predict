"use client";

import { Card, SnapshotBadge, Pill, EmptyState, fmtN } from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export default function ModelsPage() {
  const { data, error, updating, lastUpdate } = useBetMindData();
  const challengers = (data?.challengers ?? []) as {
    model_id: string;
    role: string;
    status: string;
    note: string;
    auto_promotion: boolean;
    settled_required_for_edge: number;
  }[];
  const verdict = asRecord(data?.predictive?.final_verdict);
  const manifest = asRecord(data?.predictive?.model_manifest);
  const validation = asRecord(data?.predictive?.validation);
  const holdout = asRecord(validation?.holdout);
  const metrics = asRecord(holdout?.metrics);
  const independent = asRecord(metrics?.independent);
  const market = asRecord(metrics?.market);
  const gate = asRecord(verdict?.promotion_gate);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Motore</div>
          <h1 className="text-2xl font-bold">Modelli</h1>
          <p className="bm-prose-muted mt-1 max-w-xl">
            Campione, sfidante e baseline di mercato. Le soglie restano quelle del laboratorio:
            nessuna promozione automatica e le quote non entrano nel modello indipendente.
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

      <Card title="Verdetto" glow right={<Pill accent>{String(verdict?.verdict ?? "sconosciuto")}</Pill>}>
        <p className="bm-prose">
          Modello indipendente: {String(verdict?.model_independent ?? "non dichiarato")}.
          Blocco: {String(verdict?.blocker ?? gate?.blocker ?? "nessuno segnalato")}.
          Soglia di vantaggio: {String(gate?.model_edge ?? "sconosciuta")}.
          Promozione automatica: no.
        </p>
      </Card>

      <Card title="Metriche holdout">
        {independent || market ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs bm-muted">
                <tr>
                  <th className="py-2">Fonte</th>
                  <th>Log loss</th>
                  <th>Brier</th>
                  <th>Accuratezza</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--bm-border)]">
                  <td className="py-2">Indipendente</td>
                  <td>{fmtN(independent?.log_loss as number)}</td>
                  <td>{fmtN(independent?.brier as number)}</td>
                  <td>{fmtN(independent?.accuracy as number)}</td>
                </tr>
                <tr className="border-t border-[var(--bm-border)]">
                  <td className="py-2">Mercato</td>
                  <td>{fmtN(market?.log_loss as number)}</td>
                  <td>{fmtN(market?.brier as number)}</td>
                  <td>{fmtN(market?.accuracy as number)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nessuna metrica holdout"
            reason="Il report di validazione non è presente su questo host. Niente di inventato."
          />
        )}
      </Card>

      <Card title="Registro modelli">
        <div className="space-y-3">
          {challengers.map((m) => (
            <div key={m.model_id} className="border-t border-[var(--bm-border)] pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{m.model_id}</span>
                <Pill accent={m.role === "CHAMPION"}>{m.role === "CHAMPION" ? "Campione" : m.role}</Pill>
              </div>
              <p className="mt-1 text-sm bm-muted">{m.note}</p>
              <p className="text-xs bm-muted">
                Casi liquidati richiesti per un vantaggio: {m.settled_required_for_edge}. Promozione
                automatica: {m.auto_promotion ? "sì" : "no"}.
              </p>
            </div>
          ))}
          {challengers.length === 0 && (
            <EmptyState
              title="Registro vuoto"
              reason="Nessun modello è stato pubblicato su questo host."
            />
          )}
        </div>
      </Card>

      {manifest && (
        <details className="bm-ops">
          <summary>Manifest tecnico</summary>
          <pre className="mt-3 max-h-56 overflow-auto text-[11px] text-[var(--bm-muted)]">
            {JSON.stringify(manifest, null, 2).slice(0, 2500)}
          </pre>
        </details>
      )}
    </div>
  );
}
