"use client";

import { Card, SnapshotBadge, Pill, EmptyState, fmtMoney, fmtPct } from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export default function BankrollPage() {
  const { data, error, updating, lastUpdate } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const paperReport = asRecord(data?.predictive?.paper_bankroll_report);
  const summary =
    asRecord(paperReport?.summary) ??
    asRecord(asRecord(obs?.bankroll_053)?.summary) ??
    asRecord(obs?.bankroll_053) ??
    null;
  const capital =
    asRecord(obs?.capital) ??
    ({ CAPITAL: "PAPER_1000", REAL_MONEY: false } as Record<string, unknown>);
  const ms = asRecord(obs?.multisource_055);
  const paperFlat =
    typeof summary?.current_flat === "number"
      ? (summary.current_flat as number)
      : typeof ms?.paper_bankroll === "number"
        ? (ms.paper_bankroll as number)
        : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Simulazione</div>
          <h1 className="text-2xl font-bold">Bankroll</h1>
          <p className="bm-prose-muted mt-1 max-w-xl">
            Solo carta. Capitale di riferimento 1.000 €. REAL_MONEY resta falso: nessuna puntata
            reale e nessun saldo inventato se manca il report.
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

      <Card title="Capitale simulato" glow>
        <div className="text-4xl font-bold tracking-tight">
          {paperFlat != null ? fmtMoney(paperFlat) : "—"}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill accent>Solo simulazione</Pill>
          <Pill>{String(capital.CAPITAL ?? "PAPER_1000")}</Pill>
        </div>
        {paperFlat == null ? (
          <p className="bm-prose-muted mt-3">
            Nessun report bankroll su questo host. Non mostriamo 1.000 € come se fossero un saldo
            misurato.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Profitto e perdita">
          <div className="text-2xl font-semibold">{fmtMoney(summary?.profit_flat as number)}</div>
        </Card>
        <Card title="Rendimento">
          <div className="text-2xl font-semibold">{fmtPct(summary?.roi_flat as number)}</div>
        </Card>
        <Card title="Drawdown massimo">
          <div className="text-2xl font-semibold">{fmtPct(summary?.max_drawdown_flat as number)}</div>
        </Card>
        <Card title="Scommesse">
          <div className="space-y-1 text-sm">
            <div>Liquidate: {String(summary?.n_settled ?? summary?.bets ?? "—")}</div>
            <div>Vinte: {String(summary?.wins ?? "—")}</div>
            <div>Perse: {String(summary?.losses ?? "—")}</div>
          </div>
        </Card>
      </div>

      {!summary && (
        <EmptyState
          title="Report assente"
          reason="Il report di bankroll simulato non è su questo host. Niente di inventato."
        />
      )}

      {paperReport && (
        <details className="bm-ops">
          <summary>Report tecnico</summary>
          <pre className="mt-3 max-h-56 overflow-auto text-[11px] text-[var(--bm-muted)]">
            {JSON.stringify(paperReport, null, 2).slice(0, 2500)}
          </pre>
        </details>
      )}
    </div>
  );
}
