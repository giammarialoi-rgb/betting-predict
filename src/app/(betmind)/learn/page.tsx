"use client";

import Link from "next/link";
import {
  Card,
  LiveBadge,
  Metric,
  Pill,
  Unknown,
  asRecord,
  fmtN,
} from "@/components/betmind/ui";
import { useBetMindSnapshot } from "@/components/betmind/useSnapshot";

export default function LearnPage() {
  const { data, error, updating, lastUpdate } = useBetMindSnapshot(4000);
  const cases = data?.learning_cases ?? [];
  const report = asRecord(data?.predictive?.learning_report);
  const validation = asRecord(data?.predictive?.validation);
  const metrics = asRecord(asRecord(validation?.holdout)?.metrics) ?? asRecord(validation);
  const independent = asRecord(metrics?.independent);
  const market = asRecord(metrics?.market);
  const categories = new Map<string, number>();
  const versions = new Map<string, number>();
  for (const c of cases) {
    const row = asRecord(c);
    const cat = String(row?.category ?? row?.result_class ?? "UNKNOWN");
    categories.set(cat, (categories.get(cat) ?? 0) + 1);
    const mv = String(row?.model_version ?? asRecord(row?.prediction)?.model_version ?? "N/A");
    versions.set(mv, (versions.get(mv) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Intelligence loop</div>
          <h1 className="text-2xl font-bold">Learn</h1>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="PERFORMANCE OVER TIME">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Log Loss" value={independent ? fmtN(independent.log_loss as number) : "UNKNOWN"} />
            <Metric label="Brier" value={independent ? fmtN(independent.brier as number) : "UNKNOWN"} />
            <Metric label="Accuracy" value={independent ? fmtN(independent.accuracy as number) : "UNKNOWN"} />
            <Metric label="Market LL" value={market ? fmtN(market.log_loss as number) : "N/A"} />
          </div>
        </Card>
        <Card title="ERROR CATEGORIES">
          {categories.size === 0 ? (
            <Unknown label="INSUFFICIENT_DATA" />
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

      <Card title="MODEL VERSIONS">
        {versions.size === 0 ? (
          <Unknown label="N/A" />
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
        <Card title="LEARNING REPORT">
          <pre className="max-h-40 overflow-auto text-[11px] text-[var(--bm-muted)]">
            {JSON.stringify(report, null, 2).slice(0, 1800)}
          </pre>
        </Card>
      )}

      <Card title="RECENT LESSONS" glow>
        <div className="space-y-3">
          {cases.map((c, i) => {
            const row = asRecord(c);
            const id = String(row?.event_id ?? row?.case_id ?? i);
            const pred = asRecord(row?.prediction);
            return (
              <div key={`${id}-${i}`} className="rounded-xl border border-[var(--bm-border)] bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill accent>{String(row?.category ?? "CASE")}</Pill>
                  <Pill>{String(row?.stake_outcome ?? "N/A")}</Pill>
                  <span className="text-xs bm-muted">{String(row?.created_at ?? "")}</span>
                </div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <div className="bm-metric-label">Prediction</div>
                    <div>
                      {pred
                        ? `H ${fmtN(pred.HOME as number, 2)} / D ${fmtN(pred.DRAW as number, 2)} / A ${fmtN(pred.AWAY as number, 2)}`
                        : String(row?.prediction ?? "N/A")}
                    </div>
                  </div>
                  <div>
                    <div className="bm-metric-label">Result</div>
                    <div>{String(row?.actual ?? row?.result ?? "N/A")}</div>
                  </div>
                  <div>
                    <div className="bm-metric-label">Error</div>
                    <div>
                      {row?.probability_error != null
                        ? fmtN(row.probability_error as number, 3)
                        : String(row?.error_type ?? "N/A")}
                    </div>
                  </div>
                  <div>
                    <div className="bm-metric-label">Lesson</div>
                    <div>{String(row?.calibration_note ?? row?.decision_correctness ?? "N/A")}</div>
                  </div>
                </div>
                <Link href={`/events/${id}`} className="mt-2 inline-block text-xs bm-accent underline">
                  Open event
                </Link>
              </div>
            );
          })}
          {cases.length === 0 && <Unknown label="INSUFFICIENT_DATA — no learning cases on disk" />}
        </div>
      </Card>
    </div>
  );
}
