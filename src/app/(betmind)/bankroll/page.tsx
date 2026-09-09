"use client";

import { Card, LiveBadge, Pill, Unknown, fmtMoney, fmtPct } from "@/components/betmind/ui";
import { useBetMindSnapshot } from "@/components/betmind/useSnapshot";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export default function BankrollPage() {
  const { data, error, updating, lastUpdate } = useBetMindSnapshot(4000);
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
        : 1000;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bankroll</h1>
          <p className="text-sm bm-muted">Paper trading · capitale iniziale €1000</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <LiveBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "N/A"}</span>
        </div>
      </div>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <Card title="PAPER CAPITAL" glow>
        <div className="text-4xl font-bold tracking-tight">{fmtMoney(paperFlat)}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill accent>REAL_MONEY={String(capital.REAL_MONEY ?? false)}</Pill>
          <Pill>{String(capital.CAPITAL ?? "PAPER_1000")}</Pill>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="P&L">
          <div className="text-2xl font-semibold">{fmtMoney(summary?.profit_flat as number)}</div>
        </Card>
        <Card title="ROI">
          <div className="text-2xl font-semibold">{fmtPct(summary?.roi_flat as number)}</div>
        </Card>
        <Card title="MAX DRAWDOWN">
          <div className="text-2xl font-semibold">{fmtPct(summary?.max_drawdown_flat as number)}</div>
        </Card>
        <Card title="BETS">
          <div className="text-sm space-y-1">
            <div>Settled: {String(summary?.n_settled ?? summary?.bets ?? "N/A")}</div>
            <div>Wins: {String(summary?.wins ?? "N/A")}</div>
            <div>Losses: {String(summary?.losses ?? "N/A")}</div>
          </div>
        </Card>
      </div>

      {!summary && (
        <Card>
          <Unknown label="N/A — paper-bankroll-report / bankroll_053 summary assente; capitale di riferimento €1000" />
        </Card>
      )}

      {paperReport && (
        <Card title="REPORT (disk)">
          <pre className="max-h-56 overflow-auto text-[11px] text-[var(--bm-muted)]">
            {JSON.stringify(paperReport, null, 2).slice(0, 2500)}
          </pre>
        </Card>
      )}
    </div>
  );
}
