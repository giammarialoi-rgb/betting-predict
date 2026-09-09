"use client";

import Link from "next/link";
import {
  Card,
  LiveBadge,
  Metric,
  Pill,
  Unknown,
  asRecord,
  edgeLabel,
  fmtKick,
  fmtN,
  sportBucket,
} from "@/components/betmind/ui";
import { useBetMindSnapshot } from "@/components/betmind/useSnapshot";

export default function LivePage() {
  const { data, error, updating, lastUpdate } = useBetMindSnapshot(4000);
  const obs = asRecord(data?.observatory);
  const sys = asRecord(obs?.system);
  const activity =
    asRecord(asRecord(obs?.multisource_055)?.current_activity) ?? asRecord(obs?.current_work);
  const events = ((obs?.next_events as Record<string, unknown>[]) ?? []).filter(Boolean);
  const live = events.filter((e) => /live|in_play|playing/i.test(String(e.status)));
  const decisions = events.slice(0, 12);
  const settlements = data?.recent_settlements ?? [];
  const phase = String(activity?.phase ?? sys?.phase ?? "UNKNOWN");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Monitor</div>
          <h1 className="text-2xl font-bold">Live</h1>
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

      <Card title="CURRENT ANALYSIS" glow>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Phase" value={phase} accent />
          <Metric label="Priority" value={String(sys?.last_priority ?? "N/A")} />
          <Metric label="Sport" value={String(activity?.sport ?? sys?.sport ?? "N/A")} />
          <Metric label="Note" value={String(activity?.note ?? "N/A")} />
        </div>
        {/IDLE|SLEEP/i.test(phase) && (
          <p className="mt-3 text-sm bm-muted">Waiting for next analysis — {String(activity?.note ?? phase)}</p>
        )}
      </Card>

      <Card title="LIVE EVENTS">
        {live.length === 0 ? (
          <Unknown label="INSUFFICIENT_DATA — no LIVE rows in current board" />
        ) : (
          <div className="space-y-2">
            {live.map((e) => (
              <Link key={String(e.event_id)} href={`/events/${e.event_id}`} className="block rounded-xl bg-black/20 p-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="text-[11px] bm-muted">{sportBucket(String(e.sport))} · {String(e.competition)}</div>
                    <div className="font-semibold">{String(e.label)}</div>
                  </div>
                  <Pill accent>{String(e.status)}</Pill>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card title="RECENT DECISIONS">
        <div className="space-y-2">
          {decisions.map((e) => (
            <Link key={String(e.event_id)} href={`/events/${e.event_id}`} className="flex items-center justify-between gap-2 border-t border-[var(--bm-border)] py-2 first:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{String(e.label)}</div>
                <div className="text-[11px] bm-muted">
                  {fmtKick(e.kickoff_utc as string | null)} · MODEL{" "}
                  {e.model_pct != null ? fmtN(e.model_pct as number, 1) : "N/A"} · MKT{" "}
                  {e.market_pct != null ? fmtN(e.market_pct as number, 1) : "N/A"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs bm-accent">{edgeLabel(e.edge_status, e.edge)}</div>
                <Pill>{String(e.decision ?? "N/A")}</Pill>
              </div>
            </Link>
          ))}
          {decisions.length === 0 && <Unknown label="INSUFFICIENT_DATA" />}
        </div>
      </Card>

      <Card title="RECENT RESULTS">
        <div className="space-y-2">
          {settlements.slice(0, 10).map((s, i) => {
            const row = asRecord(s);
            return (
              <div key={String(row?.event_id ?? i)} className="flex justify-between gap-2 text-sm border-t border-[var(--bm-border)] py-2 first:border-0">
                <Link className="bm-accent underline" href={`/events/${String(row?.event_id)}`}>
                  {String(row?.event_id).slice(0, 12)}…
                </Link>
                <span>
                  {String(row?.result ?? "N/A")} · {String(row?.outcome ?? "N/A")}
                </span>
              </div>
            );
          })}
          {settlements.length === 0 && <Unknown label="INSUFFICIENT_DATA — no settlements" />}
        </div>
      </Card>
    </div>
  );
}
