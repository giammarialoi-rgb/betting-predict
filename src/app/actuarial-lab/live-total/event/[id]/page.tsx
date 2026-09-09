"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { reactListKey052 } from "@/domain/eval/ui-052/keys";

type Detail = {
  event: {
    event_id: string;
    sport: string;
    competition: string;
    home_or_a: string;
    away_or_b: string;
    kickoff_utc: string | null;
    origin?: string;
    semantic_level: string;
  };
  markets: string[];
  quote_count: number;
  predictions: {
    prediction_seq: number;
    selection: string | null;
    confidence_score: number;
    human_readable_reason: string;
    timestamp: string;
    probability_model: Record<string, number> | null;
    probability_market: Record<string, number> | null;
    model_version: string;
    reason_codes: string[];
  }[];
  lock: { lock_timestamp: string; decision_context_hash: string; model_version: string } | null;
  settlement: { result: string; outcome: string; settled_at: string } | null;
  autopsies: { result_class: string; error_type: string | null; evidence: string[]; cause_hypotheses: { hypothesis: string; confidence: number }[] }[];
  windows: { window: string; status: string; missing_reason: string | null }[];
  structured_explanation: {
    WHY_SELECTED?: string[];
    WHY_NOT_SELECTED?: string[];
    FINAL?: string;
    message?: string;
  };
  post_lock_changes: Record<string, unknown>[];
  model_version: string | null;
  api_calls_ui: 0;
  coverage_bins?: Record<string, boolean>;
  structured_why_047?: {
    market_signal: { key: string; value: string | number | null; status: string };
    form_signal: { key: string; value: string | number | null; status: string };
    history_signal: { key: string; value: string | number | null; status: string };
    schedule_signal: { key: string; value: string | number | null; status: string };
    movement_signal: { key: string; value: string | number | null; status: string };
    injury_signal: { key: string; value: string | number | null; status: string };
    lineup_signal: { key: string; value: string | number | null; status: string };
    consensus_signal: { key: string; value: string | number | null; status: string };
    risk_flags: string[];
    FINAL_REASON: string;
  } | null;
  lifecycle_timeline?: { phase: string; at: string | null; done: boolean }[];
  comparison?: {
    PREDICTION: string | null;
    ACTUAL: string | null;
    WHAT_WE_KNEW: string;
    WHAT_HAPPENED: string;
    WHAT_WE_MISSED: string;
  };
  decision_048?: {
    decision: string;
    decision_reason_codes: string[];
    confidence: number;
    estimated_edge: number | null;
    risk_score: number;
    explanation: {
      WHY_PRIMARY: string;
      WHY_SUPPORTING: string[];
      WHY_AGAINST: string[];
      WHY_RISK: string[];
      WHY_NO_BET: string | null;
    };
  } | null;
  autopsy_ui?: {
    PREVISIONE: string | null;
    RISULTATO: string;
    E_ANDATA_COME_PREVISTO: string;
    RAGIONAMENTO_CORRETTO: string;
    OUTCOME_CLASS: string;
    ERROR_LABELS: string[];
    capital_note: string;
  } | null;
  decision_timeline?: { phase: string; at: string | null; done: boolean }[];
  lineage_055?: { step: string; at: string | null; ref: string | null; note: string | null }[];
  universal_055?: {
    universal_event_id: string;
    source_ids: string[];
    match_confidence: number;
    odds_status: string;
  } | null;
};

export default function LiveTotalEventPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/permanent-live/event/${params.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Detail;
        if (alive) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "fetch failed");
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [params.id]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        <Link href="/actuarial-lab/live-total">← Control Center</Link>
      </p>
      {err && <p className="text-red-600">{err}</p>}
      {data && (
        <>
          <header>
            <h1 className="text-2xl font-semibold">
              {data.event.home_or_a} vs {data.event.away_or_b}
            </h1>
            <p className="text-sm text-zinc-500">
              {data.event.sport} · {data.event.competition} · kickoff {data.event.kickoff_utc ?? "—"} · origin{" "}
              {data.event.origin ?? "—"}
            </p>
            {data.universal_055 && (
              <p className="mt-1 text-xs text-zinc-500">
                universal {data.universal_055.universal_event_id} · sources {data.universal_055.source_ids.join(", ")} ·
                odds {data.universal_055.odds_status} · match {data.universal_055.match_confidence}
              </p>
            )}
          </header>

          {data.lineage_055 && data.lineage_055.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">Data lineage</h2>
              <ol className="flex flex-col gap-1 font-mono text-xs">
                {data.lineage_055.map((s, i) => (
                  <li key={`${s.step}-${i}`}>
                    {s.step}
                    {s.at ? ` · ${s.at}` : ""}
                    {s.ref ? ` · ${s.ref}` : ""}
                    {s.note ? ` · ${s.note}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-medium">Lifecycle</h2>
            <ol className="flex flex-col gap-1 text-sm">
              {(data.decision_timeline ?? data.lifecycle_timeline ?? []).map((p, i) => (
                <li key={reactListKey052({ event_id: data.event.event_id, phase: p.phase, at: p.at ?? undefined }, i, "life")}>
                  {i > 0 ? "↓ " : ""}
                  {p.phase} · {p.done ? "done" : "pending"}
                  {p.at ? ` · ${p.at}` : ""}
                </li>
              ))}
            </ol>
          </section>

          {data.decision_048 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">Decision ({data.decision_048.decision})</h2>
              <dl className="grid gap-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>confidence / edge / risk</dt>
                  <dd>
                    {data.decision_048.confidence} / {data.decision_048.estimated_edge ?? "—"} /{" "}
                    {data.decision_048.risk_score}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>codes</dt>
                  <dd className="max-w-md text-right">{data.decision_048.decision_reason_codes.join(", ")}</dd>
                </div>
              </dl>
              <p className="mt-2 text-sm font-medium">{data.decision_048.explanation.WHY_PRIMARY}</p>
              {data.decision_048.explanation.WHY_NO_BET && (
                <p className="text-sm text-zinc-500">NO_BET: {data.decision_048.explanation.WHY_NO_BET}</p>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-medium">Timeline windows</h2>
            <p className="mb-2 text-sm text-zinc-500">Missing windows are NEVER interpolated.</p>
            <ul className="grid gap-1 text-sm">
                {data.windows.map((w, idx) => (
                  <li key={reactListKey052({ event_id: data.event.event_id, phase: w.window, status: w.status }, idx, "win")} className="flex justify-between gap-4 border-b border-zinc-100 py-1 dark:border-zinc-900">
                  <span>{w.window}</span>
                  <span>
                    {w.status}
                    {w.missing_reason ? ` · ${w.missing_reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">Markets</h2>
            <p className="text-sm">
              {data.markets.join(", ") || "—"} · {data.quote_count} quote observations
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">Predictions (immutable history)</h2>
            <ul className="space-y-3 text-sm">
              {data.predictions.map((p, idx) => (
                <li key={reactListKey052({ event_id: data.event.event_id, rank: p.prediction_seq, market: p.model_version, at: p.timestamp }, idx, "pred")} className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  <div>
                    v{p.prediction_seq} · {p.model_version} · {p.selection ?? "NO_SEL"} · conf {p.confidence_score} ·{" "}
                    {p.timestamp}
                  </div>
                  <div className="text-zinc-500">{p.human_readable_reason}</div>
                  {p.probability_model && (
                    <div className="mt-1 text-xs">MODEL {JSON.stringify(p.probability_model)}</div>
                  )}
                  {p.probability_market && (
                    <div className="text-xs">MARKET {JSON.stringify(p.probability_market)}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">WHY (structured)</h2>
            {data.structured_why_047 ? (
              <dl className="grid gap-1 text-sm">
                {(
                  [
                    ["market_signal", data.structured_why_047.market_signal],
                    ["form_signal", data.structured_why_047.form_signal],
                    ["history_signal", data.structured_why_047.history_signal],
                    ["schedule_signal", data.structured_why_047.schedule_signal],
                    ["movement_signal", data.structured_why_047.movement_signal],
                    ["injury_signal", data.structured_why_047.injury_signal],
                    ["lineup_signal", data.structured_why_047.lineup_signal],
                    ["consensus_signal", data.structured_why_047.consensus_signal],
                  ] as const
                ).map(([k, s]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt>{k}</dt>
                    <dd className="text-right">
                      {s.status === "NOT_AVAILABLE" ? "NOT_AVAILABLE" : String(s.value)}
                    </dd>
                  </div>
                ))}
                <div className="mt-2">
                  <dt className="font-medium">FINAL_REASON</dt>
                  <dd>{data.structured_why_047.FINAL_REASON}</dd>
                </div>
                {data.structured_why_047.risk_flags.length > 0 && (
                  <p className="text-zinc-500">risk: {data.structured_why_047.risk_flags.join(", ")}</p>
                )}
              </dl>
            ) : data.structured_explanation.message ? (
              <p className="text-sm">{data.structured_explanation.message}</p>
            ) : (
              <>
                <p className="text-sm font-medium">WHY SELECTED</p>
                <ul className="mb-2 list-disc pl-5 text-sm">
                  {(data.structured_explanation.WHY_SELECTED ?? []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="text-sm font-medium">WHY NOT / NEGATIVE</p>
                <ul className="mb-2 list-disc pl-5 text-sm">
                  {(data.structured_explanation.WHY_NOT_SELECTED ?? []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{data.structured_explanation.FINAL}</p>
              </>
            )}
          </section>

          {data.comparison && (
            <section>
              <h2 className="mb-2 text-lg font-medium">PREDICTION vs ACTUAL</h2>
              <dl className="grid gap-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>PREDICTION</dt>
                  <dd>{data.comparison.PREDICTION ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>ACTUAL</dt>
                  <dd>{data.comparison.ACTUAL ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>WHAT WE KNEW</dt>
                  <dd className="max-w-md text-right">{data.comparison.WHAT_WE_KNEW}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>WHAT HAPPENED</dt>
                  <dd>{data.comparison.WHAT_HAPPENED}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>WHAT WE MISSED</dt>
                  <dd className="max-w-md text-right">{data.comparison.WHAT_WE_MISSED}</dd>
                </div>
              </dl>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-medium">LOCK</h2>
            {data.lock ? (
              <dl className="grid gap-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>timestamp</dt>
                  <dd>{data.lock.lock_timestamp}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>model</dt>
                  <dd>{data.lock.model_version}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>immutability</dt>
                  <dd>LOCKED — post-lock never mutates this context</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">Not locked yet</p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">POST-LOCK CHANGES</h2>
            {data.post_lock_changes.length ? (
              <ul className="space-y-1 text-sm">
                {data.post_lock_changes.map((u, i) => (
                  <li key={i}>{JSON.stringify(u).slice(0, 200)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">None recorded</p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">RESULT</h2>
            {data.settlement ? (
              <p className="text-sm">
                {data.settlement.result} · {data.settlement.outcome} · {data.settlement.settled_at}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Awaiting settlement</p>
            )}
          </section>

          {data.autopsy_ui && (
            <section>
              <h2 className="mb-2 text-lg font-medium">Autopsy</h2>
              <dl className="grid gap-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>PREVISIONE</dt>
                  <dd>{data.autopsy_ui.PREVISIONE ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>RISULTATO REALE</dt>
                  <dd>{data.autopsy_ui.RISULTATO}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>È andata come previsto?</dt>
                  <dd>{data.autopsy_ui.E_ANDATA_COME_PREVISTO}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Ragionamento corretto?</dt>
                  <dd>{data.autopsy_ui.RAGIONAMENTO_CORRETTO}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Class</dt>
                  <dd>{data.autopsy_ui.OUTCOME_CLASS}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Error labels</dt>
                  <dd>{data.autopsy_ui.ERROR_LABELS.join(", ") || "—"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-zinc-500">{data.autopsy_ui.capital_note}</p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-medium">AUTOPSY / LEARNING</h2>
            {data.autopsies[0] ? (
              <>
                <p className="text-sm">
                  {data.autopsies[0].result_class} · {data.autopsies[0].error_type ?? "—"}
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {data.autopsies[0].evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm font-medium">Cause hypotheses</p>
                <ul className="list-disc pl-5 text-sm">
                  {data.autopsies[0].cause_hypotheses.map((h) => (
                    <li key={h.hypothesis}>
                      {h.hypothesis} ({h.confidence})
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-zinc-500">No autopsy yet — learning cases only after settlement</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
