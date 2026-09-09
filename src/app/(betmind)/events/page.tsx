"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  SnapshotBadge,
  Pill,
  Unknown,
  asRecord,
  edgeLabel,
  fmtKick,
  fmtN,
  sportBucket,
} from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";

type Ev = {
  event_id: string;
  sport: string;
  competition: string;
  label: string;
  kickoff_utc: string | null;
  status: string;
  prediction_status: string;
  decision?: string;
  model_pct?: number | null;
  market_pct?: number | null;
  edge?: number | null;
  edge_status?: string;
  ev?: number | null;
  odds?: number | null;
  why?: string;
  selection?: string | null;
  result?: string | null;
  markets?: string[];
  minutes_to_kickoff?: number | null;
};

const SPORTS = ["ALL", "FOOTBALL", "TENNIS", "BASKETBALL", "HOCKEY", "VOLLEYBALL"] as const;
const TIME_TABS = ["ALL", "LIVE", "UPCOMING", "FINISHED"] as const;
const DECISION_TABS = ["ALL", "BET", "NO BET", "LIVE", "UPCOMING"] as const;

function isLive(e: Ev): boolean {
  return /live|in_play|playing/i.test(String(e.status));
}
function isFinished(e: Ev): boolean {
  return /finish|ended|ft|final|settled/i.test(String(e.status)) || Boolean(e.result && e.result !== "N/A");
}
function isBet(e: Ev): boolean {
  return /^BET/i.test(String(e.decision ?? ""));
}
function isNoBet(e: Ev): boolean {
  const d = String(e.decision ?? e.prediction_status ?? "");
  return /NO_BET|INSUFFICIENT|SKIP|HOLD/i.test(d) || d === "N/A";
}

function EventsInner() {
  const sp = useSearchParams();
  const sport = (sp.get("sport") ?? "ALL").toUpperCase();
  const time = (sp.get("time") ?? "ALL").toUpperCase();
  const filter = (sp.get("filter") ?? "ALL").toUpperCase().replace("_", " ");
  const { data, error, updating, lastUpdate } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const events = ((obs?.next_events as Ev[]) ?? []).filter(Boolean);
  const diagnostics = asRecord(obs?.sport_diagnostics) ?? asRecord(obs?.coverage_047);

  const availableSports = useMemo(() => {
    const set = new Set(events.map((e) => sportBucket(e.sport)));
    return set;
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const bucket = sportBucket(e.sport);
      if (sport !== "ALL" && bucket !== sport) return false;
      if (time === "LIVE" && !isLive(e)) return false;
      if (time === "UPCOMING" && (isLive(e) || isFinished(e))) return false;
      if (time === "FINISHED" && !isFinished(e)) return false;
      if (filter === "BET" && !isBet(e)) return false;
      if (filter === "NO BET" && !isNoBet(e)) return false;
      if (filter === "LIVE" && !isLive(e)) return false;
      if (filter === "UPCOMING" && (isLive(e) || isFinished(e))) return false;
      return true;
    });
  }, [events, sport, time, filter]);

  function hrefFor(next: { sport?: string; time?: string; filter?: string }) {
    const q = new URLSearchParams();
    const s = next.sport ?? sport;
    const t = next.time ?? time;
    const f = next.filter ?? filter;
    if (s !== "ALL") q.set("sport", s);
    if (t !== "ALL") q.set("time", t);
    if (f !== "ALL") q.set("filter", f.replace(" ", "_"));
    const qs = q.toString();
    return qs ? `/events?${qs}` : "/events";
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Diretta</div>
          <h1 className="text-2xl font-bold">Events</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SnapshotBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "N/A"}</span>
        </div>
      </div>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <div className="bm-tabrow">
        {SPORTS.map((s) => (
          <Link key={s} href={hrefFor({ sport: s })} className={`bm-pill ${sport === s ? "bm-pill-accent" : ""}`}>
            {s}
          </Link>
        ))}
      </div>

      <div className="bm-tabrow">
        {TIME_TABS.map((t) => (
          <Link key={t} href={hrefFor({ time: t })} className={`bm-pill ${time === t ? "bm-pill-accent" : ""}`}>
            {t}
          </Link>
        ))}
      </div>

      <div className="bm-tabrow">
        {DECISION_TABS.map((f) => (
          <Link
            key={f}
            href={hrefFor({ filter: f })}
            className={`bm-pill ${filter === f ? "bm-pill-accent" : ""}`}
          >
            {f}
          </Link>
        ))}
      </div>

      {sport !== "ALL" && !availableSports.has(sport) && (
        <Card>
          <Unknown
            label={
              diagnostics
                ? `INSUFFICIENT_DATA / UNAVAILABLE — no ${sport} rows in store`
                : `INSUFFICIENT_DATA — no ${sport} events in decision board`
            }
          />
        </Card>
      )}

      <div className="grid gap-2">
        {filtered.map((e) => (
          <Link key={e.event_id} href={`/events/${e.event_id}`} className="block">
            <Card className="!p-3 transition active:scale-[0.99] hover:border-[rgba(0,246,117,0.35)]">
              <div className="bm-ev-row">
                <div className="text-center">
                  <div className="text-sm font-bold">{fmtKick(e.kickoff_utc)}</div>
                  <div className="text-[10px] bm-muted uppercase">{sportBucket(e.sport).slice(0, 3)}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] bm-muted">{e.competition}</div>
                  <div className="truncate font-semibold leading-snug">{e.label || e.event_id}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Pill>{e.status || "N/A"}</Pill>
                    {(e.markets ?? []).slice(0, 2).map((m) => (
                      <Pill key={m}>{m}</Pill>
                    ))}
                    {e.result ? <Pill>{e.result}</Pill> : null}
                  </div>
                </div>
                <div className="hidden text-xs lg:grid lg:grid-cols-3 lg:gap-3">
                  <div>
                    <div className="bm-muted">MODEL</div>
                    <div className="font-semibold bm-accent">
                      {e.model_pct != null ? fmtN(e.model_pct, 1) : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="bm-muted">MKT</div>
                    <div className="font-semibold">{e.market_pct != null ? fmtN(e.market_pct, 1) : "N/A"}</div>
                  </div>
                  <div>
                    <div className="bm-muted">ODDS</div>
                    <div className="font-semibold">{e.odds != null ? fmtN(e.odds, 2) : "N/A"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] bm-muted">EDGE</div>
                  <div className="text-sm font-bold bm-accent">{edgeLabel(e.edge_status, e.edge)}</div>
                  <Pill accent={isBet(e)}>{e.decision ?? e.prediction_status ?? "N/A"}</Pill>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] lg:hidden">
                <div>
                  <span className="bm-muted">MODEL </span>
                  {e.model_pct != null ? fmtN(e.model_pct, 1) : "N/A"}
                </div>
                <div>
                  <span className="bm-muted">MKT </span>
                  {e.market_pct != null ? fmtN(e.market_pct, 1) : "N/A"}
                </div>
                <div>
                  <span className="bm-muted">ODDS </span>
                  {e.odds != null ? fmtN(e.odds, 2) : "N/A"}
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {filtered.length === 0 && availableSports.size > 0 && (
          <Card>
            <Unknown label="INSUFFICIENT_DATA — nessun evento per questo filtro (store reale, non mock)" />
          </Card>
        )}
        {events.length === 0 && (
          <Card>
            <Unknown label="INSUFFICIENT_DATA — decision board vuota / provider window empty" />
          </Card>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<Card><Unknown label="Loading filters…" /></Card>}>
      <EventsInner />
    </Suspense>
  );
}
