"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  SnapshotBadge,
  Pill,
  Unknown,
  asRecord,
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
  probability_model?: Record<string, number> | null;
  home_or_a?: string | null;
  away_or_b?: string | null;
};

const SPORTS = ["ALL", "FOOTBALL", "TENNIS", "BASKETBALL", "HOCKEY", "VOLLEYBALL"] as const;
const TIME_TABS = ["ALL", "LIVE", "UPCOMING", "FINISHED"] as const;
const BUCKET_TABS = [
  "ALL",
  "DISCOVERED",
  "QUEUED",
  "RESEARCHING",
  "RESEARCHED",
  "MODEL_INFERENCE",
  "INSUFFICIENT_DATA",
  "SKIPPED",
] as const;

function isLive(e: Ev): boolean {
  return /live|in_play|playing/i.test(String(e.status));
}
function isFinished(e: Ev): boolean {
  return /finish|ended|ft|final|settled/i.test(String(e.status)) || Boolean(e.result && e.result !== "N/A");
}

function shiftDay(yyyyMmDd: string, delta: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function todayRome(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function EventsInner() {
  const sp = useSearchParams();
  const sport = (sp.get("sport") ?? "ALL").toUpperCase();
  const time = (sp.get("time") ?? "ALL").toUpperCase();
  const bucket = (sp.get("bucket") ?? "ALL").toUpperCase();
  const date = sp.get("date") ?? todayRome();
  const { data, error, updating, lastUpdate } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const analysis = asRecord((data as { analysis?: unknown } | null)?.analysis) ?? asRecord(obs?.analysis);
  const [calendar, setCalendar] = useState<{ total: number; events: Ev[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    q.set("date", date);
    if (sport !== "ALL") q.set("sport", sport === "FOOTBALL" ? "football" : sport.toLowerCase());
    fetch(`/api/events?${q.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setCalendar({ total: Number(body.total ?? 0), events: (body.events as Ev[]) ?? [] });
      })
      .catch(() => {
        if (!cancelled) setCalendar({ total: 0, events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [date, sport]);

  const snapshotEvents = ((obs?.next_events as Ev[]) ?? []).filter(Boolean);
  const events = calendar?.events ?? snapshotEvents;
  const diagnostics = asRecord(obs?.sport_diagnostics) ?? asRecord(obs?.coverage_047);

  const availableSports = useMemo(() => {
    const set = new Set(events.map((e) => sportBucket(e.sport)));
    return set;
  }, [events]);

  const bucketCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of BUCKET_TABS) {
      if (b !== "ALL") c[b] = 0;
    }
    for (const e of events) {
      const b = String(
        (e as Ev & { calendar_bucket?: string; bucket?: string }).calendar_bucket ??
          (e as Ev & { bucket?: string }).bucket ??
          "DISCOVERED",
      );
      c[b] = (c[b] ?? 0) + 1;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const bucketName = String(
        (e as Ev & { calendar_bucket?: string; bucket?: string }).calendar_bucket ??
          (e as Ev & { bucket?: string }).bucket ??
          "DISCOVERED",
      );
      const sportB = sportBucket(e.sport);
      if (sport !== "ALL" && sportB !== sport) return false;
      if (time === "LIVE" && !isLive(e)) return false;
      if (time === "UPCOMING" && (isLive(e) || isFinished(e))) return false;
      if (time === "FINISHED" && !isFinished(e)) return false;
      if (bucket !== "ALL" && bucketName !== bucket) return false;
      return true;
    });
  }, [events, sport, time, bucket]);

  function hrefFor(next: { sport?: string; time?: string; bucket?: string; date?: string }) {
    const q = new URLSearchParams();
    const s = next.sport ?? sport;
    const t = next.time ?? time;
    const b = next.bucket ?? bucket;
    const d = next.date ?? date;
    if (s !== "ALL") q.set("sport", s);
    if (t !== "ALL") q.set("time", t);
    if (b !== "ALL") q.set("bucket", b);
    if (d) q.set("date", d);
    const qs = q.toString();
    return qs ? `/events?${qs}` : "/events";
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Eventi</div>
          <h1 className="text-2xl font-bold">Eventi</h1>
          <p className="mt-1 text-xs bm-muted">
            {calendar?.total ?? events.length} eventi trovati per {date}
            {sport !== "ALL" ? ` · ${sport}` : ""} — nessun cap artificiale sulla lista.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Link href={hrefFor({ date: shiftDay(todayRome(), -1) })} className="bm-pill">
              Ieri
            </Link>
            <Link href={hrefFor({ date: todayRome() })} className="bm-pill">
              Oggi
            </Link>
            <Link href={hrefFor({ date: shiftDay(todayRome(), 1) })} className="bm-pill">
              Domani
            </Link>
            <Link href={hrefFor({ date: shiftDay(date, -1) })} className="bm-pill">
              ← Giorno precedente
            </Link>
            <span className="font-semibold">{date}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const v = e.target.value;
                if (v) window.location.href = hrefFor({ date: v });
              }}
              className="rounded border border-[var(--bm-border)] bg-transparent px-2 py-1 text-xs"
            />
            <Link href={hrefFor({ date: shiftDay(date, 1) })} className="bm-pill">
              Giorno successivo →
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SnapshotBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}</span>
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
        {BUCKET_TABS.map((b) => (
          <Link
            key={b}
            href={hrefFor({ bucket: b })}
            className={`bm-pill ${bucket === b ? "bm-pill-accent" : ""}`}
          >
            {b === "ALL" ? "ALL" : `${b} (${bucketCounts[b] ?? 0})`}
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
        {filtered.map((e) => {
          const row = e as Ev & {
            bucket?: string;
            calendar_bucket?: string;
            why?: string;
            research_state?: string | null;
            prediction_status?: string;
          };
          const bucketLabel = row.calendar_bucket ?? row.bucket ?? e.status;
          const hasModel =
            e.probability_model?.HOME != null &&
            e.probability_model?.DRAW != null &&
            e.probability_model?.AWAY != null;
          return (
          <Link key={e.event_id} href={`/events/${e.event_id}`} className="block">
            <Card className="!p-3 transition active:scale-[0.99] hover:border-[rgba(0,246,117,0.35)]">
              <div className="bm-ev-row">
                <div className="text-center">
                  <div className="text-sm font-bold">{fmtKick(e.kickoff_utc)}</div>
                  <div className="text-[10px] bm-muted uppercase">{sportBucket(e.sport).slice(0, 3)}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] bm-muted">{e.competition}</div>
                  <div className="truncate font-semibold leading-snug">
                    {e.home_or_a && e.away_or_b
                      ? `${e.home_or_a} vs ${e.away_or_b}`
                      : e.label && !/^[a-f0-9]{8,}$/i.test(e.label)
                        ? e.label
                        : "Partita (nomi non ancora risolti)"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Pill>{bucketLabel || "—"}</Pill>
                    {row.research_state ? <Pill>Ricerca {row.research_state}</Pill> : null}
                    <Pill>
                      {hasModel
                        ? "Modello: previsione"
                        : bucketLabel === "INSUFFICIENT_DATA"
                          ? "Modello: dati insufficienti"
                          : "Modello: non prodotto"}
                    </Pill>
                    {(e.markets ?? []).slice(0, 2).map((m) => (
                      <Pill key={m}>{m}</Pill>
                    ))}
                    {e.result ? <Pill>{e.result}</Pill> : null}
                  </div>
                  {(row.bucket === "SKIPPED" || row.bucket === "UNAVAILABLE") && row.why ? (
                    <p className="mt-1 truncate text-[11px] bm-muted">Skip: {row.why}</p>
                  ) : null}
                </div>
                <div className="hidden text-xs lg:grid lg:grid-cols-3 lg:gap-3">
                  <div>
                    <div className="bm-muted">Casa</div>
                    <div className="font-semibold bm-accent">
                      {hasModel && e.probability_model?.HOME != null
                        ? `${fmtN(e.probability_model.HOME * 100, 1)}%`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="bm-muted">Pareggio</div>
                    <div className="font-semibold">
                      {e.probability_model?.DRAW != null
                        ? `${fmtN(e.probability_model.DRAW * 100, 1)}%`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="bm-muted">Trasferta</div>
                    <div className="font-semibold">
                      {e.probability_model?.AWAY != null
                        ? `${fmtN(e.probability_model.AWAY * 100, 1)}%`
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bm-accent">Vedi analisi completa</span>
                </div>
              </div>
            </Card>
          </Link>
        );
        })}

        {filtered.length === 0 && events.length > 0 && (
          <Card>
            <Unknown label="INSUFFICIENT_DATA — nessun evento per questo filtro (store reale, non mock)" />
          </Card>
        )}
        {events.length === 0 && (
          <Card>
            <Unknown
              label={
                analysis?.no_events_reason
                  ? String(analysis.no_events_reason)
                  : "NO EVENTS AVAILABLE — decision board empty / last discovery produced no rows"
              }
            />
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
