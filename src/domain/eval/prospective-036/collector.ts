import { hashPayload } from "@/ingest/hash";
import type { OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";
import { chooseTemporalBasis, isoNow, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { loadExp036Config } from "@/domain/eval/prospective-036/config";
import {
  ProspectiveIntegrityError,
  assertExactClock,
  assertNoSynthetic,
  assertNotFutureVsCollector,
  assertQuoteBeforeKickoff,
} from "@/domain/eval/prospective-036/integrity";
import { buildDecisionContext } from "@/domain/eval/prospective-036/lock";
import {
  appendDecision,
  appendEvent,
  appendJournal,
  appendQuote,
  appendSnapshot,
  type ProspectiveStore036,
} from "@/domain/eval/prospective-036/store";
import { secondsToKickoff, windowOf } from "@/domain/eval/prospective-036/windows";
import type { AvailabilityClass036, ProspectiveQuote036 } from "@/domain/eval/prospective-036/types";

function classifyAvailability(input: {
  quoteUtc: string;
  kickoffUtc: string;
  sourceTs: string | null;
  collectorUtc: string;
  driftMaxMs: number;
}): AvailabilityClass036 {
  try {
    assertExactClock(input.quoteUtc, "quote");
    assertExactClock(input.kickoffUtc, "kickoff");
    assertQuoteBeforeKickoff(input.quoteUtc, input.kickoffUtc);
    if (input.sourceTs && parseExactUtcMs(input.sourceTs) != null) {
      assertNotFutureVsCollector(input.sourceTs, input.collectorUtc, input.driftMaxMs);
    }
    return "STRICT";
  } catch (err) {
    if (err instanceof ProspectiveIntegrityError && err.code === "QUOTE_AFTER_KICKOFF") return "POSTMATCH";
    if (err instanceof ProspectiveIntegrityError && err.code === "DATE_ONLY_PROMOTION") return "DATE_ONLY";
    return "AMBIGUOUS";
  }
}

export async function collectOnce036(input: {
  store: ProspectiveStore036;
  adapters: readonly OddsSourceAdapter[];
  clock?: { now(): Date };
  lockT1h?: boolean;
}): Promise<{ pulls: number; events: number; quotes: number; duplicates: number; strictQuotes: number; locked: number }> {
  assertNoSynthetic(false);
  const cfg = loadExp036Config();
  const clock = input.clock ?? { now: () => new Date() };
  let events = 0;
  let quotes = 0;
  let duplicates = 0;
  let strictQuotes = 0;
  let locked = 0;
  let pulls = 0;

  for (const adapter of input.adapters) {
    const requested = isoNow(clock);
    const pull = await adapter.pull({ requestedAtUtc: requested });
    pulls += 1;
    appendJournal(input.store, {
      source: pull.source,
      requested_at_utc: pull.requested_at_utc,
      received_at_utc: pull.received_at_utc,
      status: pull.status,
      error: pull.error,
      events: pull.events.length,
      quotes: pull.quotes.length,
    });
    if (pull.status !== "ok") continue;
    const collector = pull.received_at_utc ?? isoNow(clock);
    const eventBySource = new Map<string, string>();

    for (const ev of pull.events) {
      try {
        assertExactClock(ev.kickoff_at_utc, "kickoff");
      } catch {
        continue;
      }
      const existing = input.store.events.find((e) => e.source === pull.source && e.source_event_id === ev.source_event_id);
      const eventId = existing?.event_id ?? hashPayload({ s: pull.source, id: ev.source_event_id }).slice(0, 24);
      eventBySource.set(ev.source_event_id, eventId);
      if (!existing) {
        appendEvent(input.store, {
          event_id: eventId,
          source_event_id: ev.source_event_id,
          competition: ev.competition,
          season: ev.season,
          home_team: ev.home_team,
          away_team: ev.away_team,
          kickoff_at_utc: ev.kickoff_at_utc,
          source: pull.source,
          version: 1,
          supersedes: null,
          ingested_at_utc: collector,
        });
        events += 1;
      } else if (existing.kickoff_at_utc !== ev.kickoff_at_utc) {
        const nextId = `${eventId}:v${existing.version + 1}`;
        appendEvent(input.store, {
          ...existing,
          event_id: nextId,
          kickoff_at_utc: ev.kickoff_at_utc,
          version: existing.version + 1,
          supersedes: existing.event_id,
          ingested_at_utc: collector,
        });
        eventBySource.set(ev.source_event_id, nextId);
        events += 1;
      }
    }

    const pending: ProspectiveQuote036[] = [];
    for (const q of pull.quotes) {
      const ev = pull.events.find((e) => e.source_event_id === q.source_event_id);
      const eventId = eventBySource.get(q.source_event_id);
      if (!ev || !eventId) continue;
      const { basis, quoteObservedAt } = chooseTemporalBasis({
        sourceTimestampUtc: q.source_timestamp_utc,
        collectorTimestampUtc: collector,
      });
      const avail = classifyAvailability({
        quoteUtc: quoteObservedAt,
        kickoffUtc: ev.kickoff_at_utc,
        sourceTs: q.source_timestamp_utc,
        collectorUtc: collector,
        driftMaxMs: cfg.clock_drift_max_ms,
      });
      const qMs = parseExactUtcMs(quoteObservedAt);
      const kMs = parseExactUtcMs(ev.kickoff_at_utc);
      const sec = qMs != null && kMs != null ? secondsToKickoff(qMs, kMs) : null;
      const rec: ProspectiveQuote036 = {
        event_id: eventId,
        source_event_id: q.source_event_id,
        competition: ev.competition,
        season: ev.season,
        home_team: ev.home_team,
        away_team: ev.away_team,
        kickoff_at_utc: ev.kickoff_at_utc,
        market: q.market,
        selection: q.selection,
        odds_decimal: q.odds_decimal,
        quote_observed_at_utc: quoteObservedAt,
        source_timestamp_utc: q.source_timestamp_utc,
        collector_timestamp_utc: collector,
        requested_at_utc: pull.requested_at_utc,
        received_at_utc: collector,
        source: pull.source,
        bookmaker: q.bookmaker,
        source_record_id: q.source_record_id,
        observation_id: hashPayload({
          source: pull.source,
          source_record_id: q.source_record_id,
          ts: q.source_timestamp_utc,
          market: q.market,
          sel: q.selection,
          price: q.odds_decimal,
        }).slice(0, 32),
        ingested_at_utc: collector,
        temporal_basis: basis,
        availability_class: avail,
        decision_id: null,
        snapshot_id: "",
        data_fingerprint: "",
        window: sec != null ? windowOf(sec) : null,
        seconds_to_kickoff: sec,
      };
      rec.data_fingerprint = hashPayload({
        observation_id: rec.observation_id,
        quote_observed_at_utc: rec.quote_observed_at_utc,
        odds_decimal: rec.odds_decimal,
      });
      pending.push(rec);
    }

    const byEvent = new Map<string, ProspectiveQuote036[]>();
    for (const rec of pending) {
      const list = byEvent.get(rec.event_id) ?? [];
      list.push(rec);
      byEvent.set(rec.event_id, list);
    }

    for (const [eventId, list] of byEvent) {
      const ev = input.store.events.find((e) => e.event_id === eventId);
      if (!ev) continue;
      const snapAt = collector;
      const qMs = parseExactUtcMs(snapAt);
      const kMs = parseExactUtcMs(ev.kickoff_at_utc);
      const snapshotId = hashPayload({ eventId, snapAt, n: list.length }).slice(0, 24);
      let decisionId: string | null = null;
      let decisionHash: string | null = null;
      if (input.lockT1h !== false) {
        const t1 = list.filter((q) => q.window === "T-1h" && q.availability_class === "STRICT" && q.market === "1X2");
        const already = input.store.decisions.some((d) => d.event_id === eventId && d.state === "LOCKED");
        const byBook = new Map<string, typeof t1>();
        for (const q of t1) {
          const g = byBook.get(q.bookmaker) ?? [];
          g.push(q);
          byBook.set(q.bookmaker, g);
        }
        for (const [book, qs] of byBook) {
          if (already) break;
          if (qs.length < 3) continue;
          const dec = buildDecisionContext({
            decisionId: hashPayload({ eventId, book, w: "T-1h" }).slice(0, 24),
            eventId,
            decisionTimestampUtc: qs[0]!.quote_observed_at_utc,
            quotes: qs,
            bookmaker: book,
          });
          decisionId = dec.decision_id;
          decisionHash = dec.decision_context_hash;
          appendDecision(input.store, dec);
          locked += 1;
          break;
        }
      }
      let newInEvent = 0;
      for (const rec of list) {
        rec.snapshot_id = snapshotId;
        rec.decision_id = decisionId;
        const dup = appendQuote(input.store, rec);
        if (dup === "IGNORED_DUPLICATE") {
          duplicates += 1;
          continue;
        }
        quotes += 1;
        newInEvent += 1;
        if (rec.availability_class === "STRICT") strictQuotes += 1;
      }
      if (newInEvent === 0) {
        continue;
      }
      appendSnapshot(input.store, {
        snapshot_id: snapshotId,
        event_id: eventId,
        snapshot_at_utc: snapAt,
        kickoff_at_utc: ev.kickoff_at_utc,
        seconds_to_kickoff: qMs != null && kMs != null ? secondsToKickoff(qMs, kMs) : null,
        markets_present: [...new Set(list.map((q) => q.market))].sort(),
        bookmakers_present: [...new Set(list.map((q) => q.bookmaker))].sort(),
        quotes_hash: hashPayload(list.map((q) => q.observation_id).sort()),
        decision_context_hash: decisionHash,
      });
    }
  }

  return { pulls, events, quotes, duplicates, strictQuotes, locked };
}
