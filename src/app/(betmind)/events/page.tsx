"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  EmptyState,
  SnapshotBadge,
  asRecord,
  sportBucket,
} from "@/components/betmind/ui";
import { EventCard } from "@/components/betmind/EventCard";
import { RefreshEventsButton } from "@/components/betmind/RefreshEventsButton";
import { useBetMindData } from "@/components/betmind/DataProvider";
import { bucketLabelIt, formatAgeIt } from "@/domain/eval/betmind-runtime/status-copy";

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
  odds_home?: number | null;
  odds_draw?: number | null;
  odds_away?: number | null;
  bookmaker?: string | null;
  odds_market?: string | null;
  odds_compare_only?: boolean;
  probability_market?: Record<string, number> | null;
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
  "ANALYZED",
  "MODEL_INFERENCE",
  "INSUFFICIENT_DATA",
  "SKIPPED",
] as const;

function isLive(e: Ev): boolean {
  return /live|in_play|playing|\bht\b|halftime|first_half|second_half|in_progress/i.test(
    String(e.status),
  );
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
  const { data, error, updating, lastUpdate, health } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const analysis = asRecord((data as { analysis?: unknown } | null)?.analysis) ?? asRecord(obs?.analysis);
  const [calendar, setCalendar] = useState<{ total: number; events: Ev[]; note?: string; source?: string; stale?: boolean } | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    q.set("date", date);
    q.set("sport", sport === "FOOTBALL" ? "football" : sport.toLowerCase());
    fetch(`/api/events?${q.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setCalendar({
          total: Number(body.total ?? 0),
          events: (body.events as Ev[]) ?? [],
          note: typeof body.note === "string" ? body.note : undefined,
          source: typeof body.source === "string" ? body.source : undefined,
          stale: body.mirror_stale === true,
        });
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
    const c: Record<string, number> = {
      DISCOVERED: 0,
      ELIGIBLE_FOR_MODEL: 0,
      ANALYZED: 0,
      SKIPPED: 0,
      UNAVAILABLE: 0,
    };
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
          <div className="bm-section-label">Calendario</div>
          <h1 className="text-2xl font-bold">Eventi</h1>
          <p className="bm-prose-muted mt-1 max-w-xl">
            {calendar?.total ?? events.length} partite del {date}
            {sport !== "ALL" ? ` · ${bucketLabelIt(sport)}` : ""}.
            Orario, stato e quote 1X2 se ci sono.
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
            <Link href={hrefFor({ date: shiftDay(date, 1) })} className="bm-pill">
              Giorno successivo →
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs">
            <SnapshotBadge updating={updating} />
            <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString("it-IT") : "—"}</span>
          </div>
          <RefreshEventsButton
            onProgress={(msg, err) => {
              setRefreshNote(msg);
              setRefreshErr(err);
            }}
          />
        </div>
      </div>

      {(refreshNote || refreshErr) && (
        <Card>
          {refreshNote ? <p className="text-sm">{refreshNote}</p> : null}
          {refreshErr ? <p className="text-sm text-[var(--bm-danger)]">{refreshErr}</p> : null}
        </Card>
      )}

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      {(calendar?.stale || asRecord(health?.detail)?.mirror_stale === true) && (
        <Card>
          <p className="text-sm">
            Elenco dall’ultimo specchio remoto
            {typeof asRecord(health?.detail)?.mirror_age_ms === "number"
              ? ` (${formatAgeIt(asRecord(health?.detail)?.mirror_age_ms as number)})`
              : ""}
            . Il cervello sul PC può essere acceso, ma Vercel non ha un battito recente — le partite
            restano quelle dell’ultimo publish, niente di inventato.
          </p>
        </Card>
      )}

      <div className="bm-tabrow">
        {SPORTS.map((s) => (
          <Link key={s} href={hrefFor({ sport: s })} className={`bm-pill ${sport === s ? "bm-pill-accent" : ""}`}>
            {s === "ALL" ? "Tutti" : bucketLabelIt(s)}
          </Link>
        ))}
      </div>

      <div className="bm-tabrow">
        {TIME_TABS.map((t) => (
          <Link key={t} href={hrefFor({ time: t })} className={`bm-pill ${time === t ? "bm-pill-accent" : ""}`}>
            {bucketLabelIt(t)}
          </Link>
        ))}
      </div>

      <details className="bm-ops">
        <summary>Altri filtri</summary>
        <div className="bm-tabrow mt-3">
          {BUCKET_TABS.map((b) => (
            <Link
              key={b}
              href={hrefFor({ bucket: b })}
              className={`bm-pill ${bucket === b ? "bm-pill-accent" : ""}`}
            >
              {b === "ALL" ? "Tutte" : `${bucketLabelIt(b)} (${bucketCounts[b] ?? 0})`}
            </Link>
          ))}
        </div>
      </details>

      {sport !== "ALL" && !availableSports.has(sport) && (
        <EmptyState
          title={`Nessuna partita di ${bucketLabelIt(sport)}`}
          reason={
            diagnostics
              ? "Nello store reale non c’è questo sport per la data scelta. Niente di inventato."
              : "Sul board non c’è questo sport per la data scelta. Niente di inventato."
          }
        />
      )}

      <div className="grid gap-3">
        {filtered.map((e) => (
          <EventCard key={e.event_id} event={e} href={`/events/${e.event_id}`} />
        ))}

        {filtered.length === 0 && events.length > 0 && (
          <EmptyState
            title="Nessuna partita per questo filtro"
            reason="Lo store è reale: il filtro non corrisponde a nessuna riga. Cambia sport, giorno o stato."
          />
        )}
        {events.length === 0 && (
          <EmptyState
            title="Nessun evento"
            reason={
              calendar?.note ||
              (analysis?.no_events_reason
                ? String(analysis.no_events_reason)
                : calendar?.stale
                  ? "Specchio scaduto e calendario vuoto per questa data. Il PC non ha pubblicato partite recenti — niente di inventato."
                  : "Nessuna partita trovata. Vercel non inventa incontri: o lo specchio remoto è vuoto per questa data, o il PC non ha ancora pubblicato il calendario.")
            }
          />
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <EmptyState title="Caricamento" reason="Sto aprendo i filtri del calendario." />
      }
    >
      <EventsInner />
    </Suspense>
  );
}
