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
import { bucketLabelIt, decisionLabelIt, formatAgeIt } from "@/domain/eval/betmind-runtime/status-copy";

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
  const { data, error, updating, lastUpdate, health } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const analysis = asRecord((data as { analysis?: unknown } | null)?.analysis) ?? asRecord(obs?.analysis);
  const [calendar, setCalendar] = useState<{ total: number; events: Ev[]; note?: string; source?: string; stale?: boolean } | null>(null);

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
          <div className="bm-section-label">Eventi</div>
          <h1 className="text-2xl font-bold">Eventi</h1>
          <p className="mt-1 text-xs bm-muted">
            {calendar?.total ?? events.length} partite per {date}
            {sport !== "ALL" ? ` · ${bucketLabelIt(sport)}` : ""} — lista reale, nessun cap artificiale.
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

      {(calendar?.stale || asRecord(health?.detail)?.mirror_stale === true) && (
        <Card>
          <p className="text-sm">
            Elenco dall’ultimo specchio Neon
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

      <div className="bm-tabrow">
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

      {sport !== "ALL" && !availableSports.has(sport) && (
        <Card>
          <Unknown
            label={
              diagnostics
                ? `Nessuna partita di ${bucketLabelIt(sport)} nello store reale`
                : `Nessuna partita di ${bucketLabelIt(sport)} sul board`
            }
          />
        </Card>
      )}

      <div className="grid gap-2">
        {filtered.map((e) => {
          const row = e as Ev & { bucket?: string; calendar_bucket?: string; why?: string };
          const bucketLabel = row.calendar_bucket ?? row.bucket ?? e.status;
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
                      : e.label || e.event_id}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Pill>{decisionLabelIt(String(e.decision ?? e.prediction_status ?? bucketLabel))}</Pill>
                    {(e.markets ?? []).slice(0, 2).map((m) => (
                      <Pill key={m}>{m === "1X2" ? "Risultato 1X2" : m}</Pill>
                    ))}
                    {e.result ? <Pill>{e.result}</Pill> : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="bm-muted">Modello</div>
                      <div className="font-semibold">
                        {e.probability_model &&
                        (e.probability_model.HOME != null ||
                          e.probability_model.DRAW != null ||
                          e.probability_model.AWAY != null)
                          ? `${e.probability_model.HOME != null ? fmtN(e.probability_model.HOME * 100, 0) : "—"} / ${e.probability_model.DRAW != null ? fmtN(e.probability_model.DRAW * 100, 0) : "—"} / ${e.probability_model.AWAY != null ? fmtN(e.probability_model.AWAY * 100, 0) : "—"}`
                          : decisionLabelIt(String(e.decision ?? e.prediction_status ?? bucketLabel))}
                      </div>
                    </div>
                    <div>
                      <div className="bm-muted">Quote{e.bookmaker ? ` · ${e.bookmaker}` : ""}</div>
                      <div className="font-semibold">
                        {e.odds_home != null && e.odds_draw != null && e.odds_away != null
                          ? `${fmtN(e.odds_home, 2)} / ${fmtN(e.odds_draw, 2)} / ${fmtN(e.odds_away, 2)}`
                          : "Quote non disponibili"}
                      </div>
                    </div>
                  </div>
                  {(row.bucket === "SKIPPED" || row.bucket === "UNAVAILABLE") && row.why ? (
                    <p className="mt-1 truncate text-[11px] bm-muted">{decisionLabelIt(String(row.why))}</p>
                  ) : null}
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
            <Unknown label="Nessuna partita per questo filtro (store reale, non mock)" />
          </Card>
        )}
        {events.length === 0 && (
          <Card>
            <Unknown
              label={
                calendar?.note ||
                (analysis?.no_events_reason
                  ? String(analysis.no_events_reason)
                  : "Nessuna partita trovata. Vercel non inventa incontri: o lo specchio Neon è vuoto per questa data, o il PC non ha ancora pubblicato il calendario.")
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
    <Suspense fallback={<Card><Unknown label="Carico i filtri…" /></Card>}>
      <EventsInner />
    </Suspense>
  );
}
