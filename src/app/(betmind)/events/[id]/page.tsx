"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  LiveBadge,
  Metric,
  Pill,
  Unknown,
  asRecord,
  edgeLabel,
  fmtN,
  fmtPct,
} from "@/components/betmind/ui";

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
  }[];
  settlement: {
    result: string;
    outcome: string;
    settled_at: string;
  } | null;
  autopsies: {
    result_class: string;
    error_type: string | null;
    evidence: string[];
    missed_signals?: string[];
  }[];
  structured_explanation: {
    WHY_SELECTED?: string[];
    WHY_NOT_SELECTED?: string[];
    FINAL?: string;
    WHY_NO_BET?: string | null;
  };
  why_buckets?: Record<string, string[]>;
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
  learning_case?: Record<string, unknown> | null;
  post_match?: {
    prediction: string;
    actual_result: string;
    model_probability: number | null;
    probability_error: number | null;
    decision: string;
    bet_result: string;
    pnl: number | null;
    autopsy_class: string;
    error_type: string | null;
    lesson: string;
  } | null;
  model_version: string | null;
  finished?: boolean;
  api_calls_ui: 0;
};

export default function EventDetailPage() {
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
        if (alive) setErr(e instanceof Error ? e.message : "fetch failed");
      } finally {
        if (alive) setUpdating(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [params.id]);

  const pred = data?.predictions?.[0];
  const modelTop =
    pred?.probability_model &&
    Object.entries(pred.probability_model).sort((a, b) => b[1] - a[1])[0];
  const edgeStatus = data?.decision_048?.edge_status ?? "UNKNOWN";
  const buckets = data?.why_buckets ?? {};
  const post = data?.post_match;
  const learn = asRecord(data?.learning_case);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/events" className="text-sm bm-muted underline">
          ← Events
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <LiveBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "N/A"}</span>
        </div>
      </div>

      {err && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{err}</p>
        </Card>
      )}
      {!data && !err && (
        <Card>
          <Unknown label="Loading…" />
        </Card>
      )}

      {data && (
        <>
          <header className="bm-hero text-center">
            <div className="bm-section-label">{data.event.competition}</div>
            <h1 className="mt-2 text-2xl font-bold leading-tight">
              {data.event.home_or_a}
              <span className="mx-2 text-base bm-muted">vs</span>
              {data.event.away_or_b}
            </h1>
            <p className="mt-2 text-sm bm-muted">
              {data.event.sport} · {data.event.kickoff_utc ?? "kickoff N/A"} ·{" "}
              {data.event.status ?? data.event.semantic_level}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Pill accent>{data.model_version ?? pred?.model_version ?? "N/A"}</Pill>
              <Pill>{data.decision_048?.decision ?? "N/A"}</Pill>
            </div>
          </header>

          <div className="bm-flow">
            <strong>PREDICT</strong> → DECIDE → RESULT → AUTOPSY → <strong>LEARN</strong>
          </div>

          <Card title="OVERVIEW">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric
                label="MODEL %"
                value={
                  data.decision_048?.model_pct != null
                    ? fmtN(data.decision_048.model_pct, 1)
                    : modelTop
                      ? fmtPct(modelTop[1])
                      : "N/A"
                }
                accent
              />
              <Metric
                label="MARKET %"
                value={
                  data.decision_048?.market_pct != null
                    ? fmtN(data.decision_048.market_pct, 1)
                    : "N/A"
                }
              />
              <Metric
                label="EDGE"
                value={edgeLabel(edgeStatus, data.decision_048?.estimated_edge)}
                accent
              />
              <Metric label="EV" value="N/A" />
              <Metric label="DECISION" value={data.decision_048?.decision ?? "N/A"} />
              <Metric
                label="STAKE"
                value={
                  data.decision_048?.stake != null ? String(data.decision_048.stake) : "N/A"
                }
              />
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="MODEL" glow>
              <div className="text-lg font-semibold">
                {modelTop ? `${modelTop[0]} ${fmtPct(modelTop[1])}` : "INSUFFICIENT_DATA"}
              </div>
              <div className="mt-2 text-xs bm-muted">sel: {pred?.selection ?? "N/A"}</div>
              <div className="mt-1 text-xs bm-muted">conf: {fmtN(pred?.confidence_score, 2)}</div>
              {pred?.probability_model && (
                <ul className="mt-3 space-y-1 text-sm">
                  {Object.entries(pred.probability_model).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="bm-accent">{fmtPct(v)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="MARKET">
              {pred?.probability_market ? (
                <ul className="space-y-1 text-sm">
                  {Object.entries(pred.probability_market).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span>{fmtPct(v)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Unknown label="INSUFFICIENT_DATA — market probs unavailable" />
              )}
              <div className="mt-3">
                <Metric
                  label="MARKET %"
                  value={
                    data.decision_048?.market_pct != null
                      ? fmtN(data.decision_048.market_pct, 1)
                      : "N/A"
                  }
                />
              </div>
            </Card>
          </div>

          <Card title="WHY BETMIND?" glow>
            <p className="text-sm leading-relaxed">
              {data.decision_048?.explanation.WHY_PRIMARY ??
                pred?.human_readable_reason ??
                "INSUFFICIENT_DATA"}
            </p>
            {data.structured_explanation.WHY_NO_BET && (
              <p className="mt-2 text-sm text-[var(--bm-warn)]">
                NO BET: {data.structured_explanation.WHY_NO_BET}
              </p>
            )}
            <div className="mt-4 space-y-3">
              {Object.keys(buckets).length === 0 && (
                <Unknown label="INSUFFICIENT_DATA — no categorized WHY signals" />
              )}
              {Object.entries(buckets).map(([k, vals]) => (
                <div key={k}>
                  <div className="bm-section-label">{k.replace("_", "/")}</div>
                  <ul className="mt-1 list-disc pl-4 text-sm">
                    {vals.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {(pred?.reason_codes?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {pred!.reason_codes.map((c) => (
                  <Pill key={c}>{c}</Pill>
                ))}
              </div>
            )}
          </Card>

          <Card title="DECISION" right={<Pill accent>{data.decision_048?.decision ?? "N/A"}</Pill>}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Confidence" value={fmtN(data.decision_048?.confidence, 2)} />
              <Metric
                label="EDGE"
                value={edgeLabel(edgeStatus, data.decision_048?.estimated_edge)}
                accent
              />
              <Metric label="Model version" value={data.model_version ?? "N/A"} />
              <Metric label="Stake" value={String(data.decision_048?.stake ?? "N/A")} />
            </div>
            <div className="mt-3 text-sm">
              <div className="bm-metric-label">Supporting</div>
              <ul className="list-disc pl-4">
                {(data.decision_048?.explanation.WHY_SUPPORTING ?? []).map((x) => (
                  <li key={x}>{x}</li>
                ))}
                {(data.decision_048?.explanation.WHY_SUPPORTING ?? []).length === 0 && (
                  <li>
                    <Unknown />
                  </li>
                )}
              </ul>
            </div>
          </Card>

          <Card title="RESULT">
            {data.settlement ? (
              <div className="space-y-1 text-sm">
                <div>Result: {data.settlement.result}</div>
                <div>Outcome: {data.settlement.outcome}</div>
                <div className="bm-muted text-xs">{data.settlement.settled_at}</div>
              </div>
            ) : (
              <Unknown label="N/A — not settled yet" />
            )}
          </Card>

          {(data.finished || post) && (
            <Card title="POST-MATCH ANALYSIS" glow>
              <div className="bm-flow mb-3">
                <strong>PREDICT</strong> ↓ <strong>DECIDE</strong> ↓ <strong>RESULT</strong> ↓{" "}
                <strong>AUTOPSY</strong> ↓ <strong>LEARN</strong>
              </div>
              {post ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Prediction" value={post.prediction} />
                  <Metric label="Actual result" value={post.actual_result} accent />
                  <Metric
                    label="Model probability"
                    value={
                      post.model_probability != null ? fmtPct(post.model_probability) : "N/A"
                    }
                  />
                  <Metric
                    label="Probability error"
                    value={
                      post.probability_error != null ? fmtN(post.probability_error, 3) : "N/A"
                    }
                  />
                  <Metric label="Decision" value={post.decision} />
                  <Metric label="Bet result" value={post.bet_result} />
                  <Metric
                    label="P&L"
                    value={post.pnl != null ? fmtN(post.pnl, 2) : "N/A"}
                  />
                  <Metric label="Autopsy class" value={post.autopsy_class} />
                </div>
              ) : (
                <Unknown label="INSUFFICIENT_DATA — post-match fields unavailable" />
              )}
            </Card>
          )}

          <Card title="AUTOPSY">
            {data.autopsies?.[0] ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Pill accent>{data.autopsies[0].result_class}</Pill>
                  {data.autopsies[0].error_type && <Pill>{data.autopsies[0].error_type}</Pill>}
                </div>
                <div className="bm-section-label">
                  {/CORRECT|SUCCESS|WIN/i.test(data.autopsies[0].result_class)
                    ? "WHY RIGHT?"
                    : "WHY WRONG?"}
                </div>
                <ul className="list-disc pl-4">
                  {(data.autopsies[0].evidence ?? []).slice(0, 8).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {(data.autopsies[0].evidence ?? []).length === 0 && (
                    <li>
                      <Unknown label="INSUFFICIENT_DATA" />
                    </li>
                  )}
                </ul>
                {(data.autopsies[0].missed_signals?.length ?? 0) > 0 && (
                  <div className="text-xs bm-muted">
                    Missed: {data.autopsies[0].missed_signals!.join(", ")}
                  </div>
                )}
              </div>
            ) : (
              <Unknown label="INSUFFICIENT_DATA — no autopsy" />
            )}
          </Card>

          <Card title="WHAT DID BETMIND LEARN?">
            {learn ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Pill accent>{String(learn.category ?? "CASE")}</Pill>
                  <Pill>{String(learn.stake_outcome ?? "N/A")}</Pill>
                </div>
                <p>{String(learn.calibration_note ?? learn.decision_correctness ?? post?.lesson ?? "N/A")}</p>
                <p className="bm-muted text-xs">
                  actual={String(learn.actual ?? "N/A")} · error=
                  {learn.probability_error != null
                    ? fmtN(learn.probability_error as number, 3)
                    : "N/A"}
                </p>
                <Link href="/learn" className="bm-accent text-xs underline">
                  All lessons
                </Link>
              </div>
            ) : (
              <Unknown label="INSUFFICIENT_DATA — no learning case for this event" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
