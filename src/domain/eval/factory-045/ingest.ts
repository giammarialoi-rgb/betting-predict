import { createHash } from "node:crypto";
import { join } from "node:path";
import { hasUtcOffset } from "@/domain/eval/prospective-036/clocks";
import { sportKind044 } from "@/domain/eval/permanent-044/config";
import { canonicalEventId044 } from "@/domain/eval/permanent-044/normalize";
import { normalizeMarketType044 } from "@/domain/eval/permanent-044/taxonomy";
import {
  appendEvent044,
  appendQuote044,
  appendJsonl044,
  type Store044,
} from "@/domain/eval/permanent-044/store";
import type { PermanentEvent044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";
import type { ParsedEvent045, ParsedQuote045 } from "@/domain/eval/factory-045/pull";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function eventIdFromSource045(sourceEventId: string): string {
  return `pl045_${sha(`the-odds-api|${sourceEventId}`).slice(0, 20)}`;
}

export function ingestDiscovered045(input: {
  store: Store044;
  sportKey: string;
  events: ParsedEvent045[];
  quotes: ParsedQuote045[];
  collectedAt: string;
  rawHash: string;
}): { eventsInserted: number; quotesInserted: number; duplicates: number } {
  let eventsInserted = 0;
  let quotesInserted = 0;
  let duplicates = 0;
  const bySource = new Map<string, PermanentEvent044>();

  for (const ev of input.events) {
    const kickOk = hasUtcOffset(ev.kickoff_at_utc);
    const sport = sportKind044(ev.sport_key || input.sportKey);
    const competition = ev.sport_key || input.sportKey;
    const canonical = canonicalEventId044({
      sport,
      competition,
      home: ev.home_team,
      away: ev.away_team,
      kickoff_utc: kickOk ? ev.kickoff_at_utc : null,
    });
    const event_id = eventIdFromSource045(ev.source_event_id);
    const fingerprint = sha(
      ["event", "the-odds-api", ev.source_event_id, canonical, ev.kickoff_at_utc, ev.home_team, ev.away_team].join("|"),
    );
    const pev: PermanentEvent044 = {
      event_id,
      canonical_event_id: canonical,
      source: "the-odds-api",
      source_event_id: ev.source_event_id,
      source_event_ids: [ev.source_event_id],
      sport,
      competition,
      country: null,
      home_or_a: ev.home_team,
      away_or_b: ev.away_team,
      kickoff_utc: kickOk ? ev.kickoff_at_utc : null,
      collected_at_utc: input.collectedAt,
      available_at_utc: null,
      semantic_level: kickOk ? "STRICT" : "INVALID",
      data_quality: kickOk ? 0.75 : 0.2,
      fingerprint,
      status: kickOk ? "OK" : "INVALID_KICKOFF",
      origin: "DISCOVERED_LIVE",
      first_seen_at: input.collectedAt,
      last_seen_at: input.collectedAt,
      canonicalization_status: "MATCH_EXACT",
    };
    const r = appendEvent044(input.store, pev);
    if (r === "ok") {
      eventsInserted += 1;
      appendJsonl044(join(input.store.root, "event_catalog", "catalog.jsonl"), {
        ...pev,
        scheduled_start_utc: pev.kickoff_utc,
        discovered_at: input.collectedAt,
      });
    } else duplicates += 1;
    bySource.set(ev.source_event_id, pev);
  }

  for (const q of input.quotes) {
    const pev = bySource.get(q.source_event_id) ?? input.store.events.find((e) => e.source_event_id === q.source_event_id);
    if (!pev) continue;
    const tax = normalizeMarketType044(q.market, pev.sport);
    const fingerprint = sha(
      [
        "quote",
        pev.event_id,
        q.bookmaker,
        q.market,
        q.selection,
        String(q.odds_decimal),
        q.available_at ?? "null_avail",
        input.collectedAt,
        q.source_record_id,
        input.rawHash.slice(0, 16),
      ].join("|"),
    );
    const pq: PermanentQuote044 = {
      event_id: pev.event_id,
      bookmaker: q.bookmaker,
      market: q.market,
      market_group: tax.market_group,
      market_type: tax.market_type,
      selection: q.selection,
      line: q.line,
      price: q.odds_decimal,
      available_at_utc: q.available_at,
      collected_at_utc: input.collectedAt,
      source: "the-odds-api",
      market_available: true,
      fingerprint,
    };
    const r = appendQuote044(input.store, pq);
    if (r === "ok") quotesInserted += 1;
    else duplicates += 1;
  }

  return { eventsInserted, quotesInserted, duplicates };
}
