import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPayload } from "@/ingest/hash";
import type { OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";
import { hasUtcOffset, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { secondsToKickoff } from "@/domain/eval/prospective-036/windows";
import { buildDecisionContext } from "@/domain/eval/prospective-036/lock";
import type { ProspectiveQuote036 } from "@/domain/eval/prospective-036/types";
import { lastAtOrBeforeCutoff039, observationWindow039, t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { availableAt039, classifyQuote039, isStrict039, matchGrade039 } from "@/domain/eval/live-039/classify";
import { failureMode039 } from "@/domain/eval/live-039/sources";
import {
  appendDecision039,
  appendJournal039,
  appendQuote039,
  loadStore039,
  upsertEvent039,
  type Store039,
} from "@/domain/eval/live-039/store";
import type { Quote039 } from "@/domain/eval/live-039/types";

export function persistRaw039(root: string, source: string, payload: unknown): { sha256: string; bytes: number } {
  const text = JSON.stringify(payload);
  const sha256 = createHash("sha256").update(text).digest("hex");
  const dir = join(root, "raw", source);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sha256}.json`);
  if (!existsSync(path)) writeFileSync(path, text);
  return { sha256, bytes: Buffer.byteLength(text) };
}

function toLockQuotes(qs: readonly Quote039[], ev: { home_team: string; away_team: string; commence_time: string; sport_key: string }): ProspectiveQuote036[] {
  return qs.map((q) => ({
    event_id: q.event_id,
    source_event_id: ev.sport_key,
    competition: ev.sport_key,
    season: null,
    home_team: ev.home_team,
    away_team: ev.away_team,
    kickoff_at_utc: ev.commence_time,
    market: q.market,
    selection: q.outcome,
    odds_decimal: q.price,
    quote_observed_at_utc: q.available_at ?? q.source_quote_timestamp ?? q.collected_at,
    source_timestamp_utc: q.source_quote_timestamp,
    collector_timestamp_utc: q.collected_at,
    requested_at_utc: q.collected_at,
    received_at_utc: q.collected_at,
    source: "the-odds-api",
    bookmaker: q.bookmaker,
    source_record_id: `${q.event_id}|${q.bookmaker}|${q.market}|${q.outcome}`,
    observation_id: quoteKeyLoose(q),
    ingested_at_utc: q.collected_at,
    temporal_basis: "SOURCE_TIMESTAMP",
    availability_class: "STRICT",
    decision_id: null,
    snapshot_id: "",
    data_fingerprint: "",
    window: q.window,
    seconds_to_kickoff: q.offset_seconds_from_kickoff,
  }));
}

function quoteKeyLoose(q: Quote039): string {
  return hashPayload({
    e: q.event_id,
    b: q.bookmaker,
    m: q.market,
    o: q.outcome,
    t: q.source_quote_timestamp,
    p: q.price,
  }).slice(0, 32);
}

export async function collectOnce039(input: {
  store: Store039;
  adapters: readonly OddsSourceAdapter[];
  clock?: { now(): Date };
  nowUtc?: string;
}): Promise<{
  pulls: number;
  events: number;
  quotes: number;
  duplicates: number;
  strictQuotes: number;
  locked: number;
  invalidKickoff: number;
}> {
  const now = input.nowUtc ?? (input.clock ?? { now: () => new Date() }).now().toISOString();
  let events = 0;
  let quotes = 0;
  let duplicates = 0;
  let strictQuotes = 0;
  let locked = 0;
  let invalidKickoff = 0;
  let pulls = 0;

  for (const adapter of input.adapters) {
    const pull = await adapter.pull({ requestedAtUtc: now });
    pulls += 1;
    let rawHash = pull.raw_hash ?? null;
    if (pull.raw_json !== undefined) {
      const saved = persistRaw039(input.store.root, pull.source, pull.raw_json);
      rawHash = saved.sha256;
    }
    appendJournal039(input.store, {
      source: pull.source,
      requested_at_utc: pull.requested_at_utc,
      received_at_utc: pull.received_at_utc,
      status: pull.status,
      error: pull.error,
      failure_mode: failureMode039(pull.error),
      events: pull.events.length,
      quotes: pull.quotes.length,
    });
    if (pull.status !== "ok") continue;
    const collectedAt = pull.received_at_utc ?? now;
    const eventBySource = new Map<string, string>();

    for (const ev of pull.events) {
      const kickOk = Boolean(ev.kickoff_at_utc && hasUtcOffset(ev.kickoff_at_utc) && parseExactUtcMs(ev.kickoff_at_utc) != null);
      const eventId = hashPayload({ s: pull.source, id: ev.source_event_id }).slice(0, 24);
      eventBySource.set(ev.source_event_id, eventId);
      const rec = {
        event_id: eventId,
        source_event_id: ev.source_event_id,
        sport_key: ev.competition,
        home_team: ev.home_team,
        away_team: ev.away_team,
        commence_time: kickOk ? ev.kickoff_at_utc : null,
        source: pull.source,
        first_seen_at: collectedAt,
        last_seen_at: collectedAt,
        kickoff_status: kickOk ? ("OK" as const) : ("INVALID_KICKOFF" as const),
      };
      if (!kickOk) invalidKickoff += 1;
      if (upsertEvent039(input.store, rec) === "inserted") events += 1;
    }

    for (const q of pull.quotes) {
      const ev = pull.events.find((e) => e.source_event_id === q.source_event_id);
      const eventId = eventBySource.get(q.source_event_id);
      const stored = input.store.events.find((e) => e.event_id === eventId);
      if (!ev || !eventId || !stored) continue;
      const match = matchGrade039({
        home: stored.home_team,
        away: stored.away_team,
        commenceTime: stored.commence_time,
        sourceEventId: stored.source_event_id,
        sportKey: stored.sport_key,
      });
      const cls = classifyQuote039({
        sourceQuoteTimestamp: q.source_timestamp_utc,
        commenceTime: stored.commence_time,
        collectedAt,
        market: q.market,
        match,
      });
      const available = availableAt039(q.source_timestamp_utc);
      const qMs = parseExactUtcMs(available);
      const kMs = parseExactUtcMs(stored.commence_time);
      const offset = qMs != null && kMs != null ? secondsToKickoff(qMs, kMs) : null;
      const win = available && stored.commence_time ? observationWindow039(available, stored.commence_time) : null;
      const rec: Quote039 = {
        event_id: eventId,
        market: q.market,
        bookmaker: q.bookmaker,
        outcome: q.selection,
        price: q.odds_decimal,
        source_quote_timestamp: q.source_timestamp_utc,
        collected_at: collectedAt,
        available_at: available,
        raw_payload_hash: rawHash ?? hashPayload({ q: q.source_record_id, t: q.source_timestamp_utc }),
        temporal_class: cls,
        match_status: match,
        window: win,
        offset_seconds_from_kickoff: offset,
        coverage_status: win ? "COVERED" : offset != null && offset > 0 ? "OUT_OF_WINDOW" : "NO_OBSERVATION",
      };
      const ins = appendQuote039(input.store, rec);
      if (ins === "IGNORED_DUPLICATE") {
        duplicates += 1;
        continue;
      }
      quotes += 1;
      if (isStrict039(cls, match)) strictQuotes += 1;
    }

    const nowMs = parseExactUtcMs(now);
    for (const ev of input.store.events) {
      if (ev.kickoff_status !== "OK" || !ev.commence_time || nowMs == null) continue;
      if (input.store.decisions.some((d) => d.event_id === ev.event_id)) continue;
      const kickMs = parseExactUtcMs(ev.commence_time);
      const cutoff = t1hCutoffMs039(ev.commence_time);
      if (kickMs == null || cutoff == null) continue;
      if (nowMs < cutoff || nowMs >= kickMs) continue;
      const pool = input.store.quotes
        .filter((q) => q.event_id === ev.event_id && q.market === "1X2" && q.available_at && isStrict039(q.temporal_class, q.match_status))
        .map((q) => ({ ...q, sourceMs: parseExactUtcMs(q.available_at)! }))
        .filter((q) => Number.isFinite(q.sourceMs));
      const byBook = new Map<string, typeof pool>();
      for (const q of pool) {
        const g = byBook.get(q.bookmaker) ?? [];
        g.push(q);
        byBook.set(q.bookmaker, g);
      }
      for (const [book, qs] of byBook) {
        const chosen: Quote039[] = [];
        for (const sel of ["HOME", "DRAW", "AWAY"]) {
          const hit = lastAtOrBeforeCutoff039(
            qs.filter((q) => q.outcome === sel),
            cutoff,
          );
          if (!hit) {
            chosen.length = 0;
            break;
          }
          chosen.push(hit);
        }
        if (chosen.length !== 3) continue;
        const dec = buildDecisionContext({
          decisionId: hashPayload({ eventId: ev.event_id, book, w: "T-1h" }).slice(0, 24),
          eventId: ev.event_id,
          decisionTimestampUtc: chosen[0]!.available_at!,
          bookmaker: book,
          quotes: toLockQuotes(chosen, {
            home_team: ev.home_team,
            away_team: ev.away_team,
            commence_time: ev.commence_time,
            sport_key: ev.sport_key,
          }),
        });
        appendDecision039(input.store, { ...dec, observation_only: true });
        locked += 1;
        break;
      }
    }
  }

  return { pulls, events, quotes, duplicates, strictQuotes, locked, invalidKickoff };
}

export { loadStore039 };
