"use client";

import { Card, LiveBadge, Pill, Unknown, fmtN } from "@/components/betmind/ui";
import { useBetMindSnapshot } from "@/components/betmind/useSnapshot";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export default function ModelsPage() {
  const { data, error, updating, lastUpdate } = useBetMindSnapshot(8000);
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
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modelli AI</h1>
          <p className="text-sm bm-muted">Champion / Challenger / Market baseline · PI disk</p>
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

      <Card title="VERDICT" glow right={<Pill accent>{String(verdict?.verdict ?? "UNKNOWN")}</Pill>}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>Independent: {String(verdict?.model_independent ?? "N/A")}</div>
          <div>Blocker: {String(verdict?.blocker ?? gate?.blocker ?? "N/A")}</div>
          <div>
            MODEL_EDGE:{" "}
            <span className="bm-accent">{String(gate?.model_edge ?? "UNKNOWN")}</span>
          </div>
          <div>Auto-promotion: false</div>
        </div>
      </Card>

      <Card title="HOLDOUT METRICS">
        {independent || market ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs bm-muted">
                <tr>
                  <th className="py-2">Source</th>
                  <th>LogLoss</th>
                  <th>Brier</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--bm-border)]">
                  <td className="py-2">Independent</td>
                  <td>{fmtN(independent?.log_loss as number)}</td>
                  <td>{fmtN(independent?.brier as number)}</td>
                  <td>{fmtN(independent?.accuracy as number)}</td>
                </tr>
                <tr className="border-t border-[var(--bm-border)]">
                  <td className="py-2">Market</td>
                  <td>{fmtN(market?.log_loss as number)}</td>
                  <td>{fmtN(market?.brier as number)}</td>
                  <td>{fmtN(market?.accuracy as number)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <Unknown label="UNKNOWN — validation-report assente o incompleto" />
        )}
      </Card>

      <Card title="REGISTRY">
        <div className="space-y-3">
          {challengers.map((m) => (
            <div key={m.model_id} className="border-t border-[var(--bm-border)] pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{m.model_id}</span>
                <Pill accent={m.role === "CHAMPION"}>{m.role}</Pill>
                <Pill>{m.status}</Pill>
              </div>
              <p className="mt-1 text-xs bm-muted">{m.note}</p>
              <p className="text-[10px] bm-muted">
                settled_required_for_edge={m.settled_required_for_edge} · auto_promotion=
                {String(m.auto_promotion)}
              </p>
            </div>
          ))}
          {challengers.length === 0 && <Unknown label="N/A — registry vuoto" />}
        </div>
      </Card>

      {manifest && (
        <Card title="MODEL MANIFEST">
          <pre className="max-h-56 overflow-auto text-[11px] text-[var(--bm-muted)]">
            {JSON.stringify(manifest, null, 2).slice(0, 2500)}
          </pre>
        </Card>
      )}
    </div>
  );
}
