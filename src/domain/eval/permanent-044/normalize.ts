import { createHash } from "node:crypto";
import type { Event039, Quote039 } from "@/domain/eval/live-039/types";
import { sportKind044 } from "@/domain/eval/permanent-044/config";
import { normalizeMarketType044 } from "@/domain/eval/permanent-044/taxonomy";
import type { PermanentEvent044, PermanentQuote044, SemanticLevel044 } from "@/domain/eval/permanent-044/types";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Canonical id from normalized identity — not raw source label. */
export function canonicalEventId044(ev: {
  sport: string;
  competition: string;
  home: string;
  away: string;
  kickoff_utc: string | null;
}): string {
  const norm = (x: string) =>
    x
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "_");
  const kick = ev.kickoff_utc ? ev.kickoff_utc.slice(0, 16) : "unknown_kick";
  return sha(
    ["v1", norm(ev.sport), norm(ev.competition), norm(ev.home), norm(ev.away), kick].join("|"),
  ).slice(0, 24);
}

export function semanticFromEvent039(ev: Event039): SemanticLevel044 {
  if (!ev.commence_time) return "PARTIAL";
  if (ev.kickoff_status === "OK") return "STRICT";
  if (ev.kickoff_status === "INVALID_KICKOFF") return "INVALID";
  return "RESEARCH";
}

export function event039ToPermanent044(ev: Event039, collectedAt: string): PermanentEvent044 {
  const sport = sportKind044(ev.sport_key);
  const competition = ev.sport_key;
  const kickoff = ev.commence_time;
  const canonical = canonicalEventId044({
    sport,
    competition,
    home: ev.home_team,
    away: ev.away_team,
    kickoff_utc: kickoff,
  });
  const fingerprint = sha(
    ["event", ev.source, ev.source_event_id, canonical, kickoff ?? "", ev.home_team, ev.away_team].join("|"),
  );
  return {
    event_id: ev.event_id,
    canonical_event_id: canonical,
    source: ev.source,
    source_event_id: ev.source_event_id,
    source_event_ids: [ev.source_event_id],
    sport,
    competition,
    country: null,
    home_or_a: ev.home_team,
    away_or_b: ev.away_team,
    kickoff_utc: kickoff,
    collected_at_utc: collectedAt,
    available_at_utc: null,
    semantic_level: semanticFromEvent039(ev),
    data_quality: semanticFromEvent039(ev) === "STRICT" ? 0.8 : 0.4,
    fingerprint,
    status: ev.kickoff_status,
    origin: "LAB_A_SEED",
    first_seen_at: ev.first_seen_at,
    last_seen_at: collectedAt,
    canonicalization_status: "MATCH_EXACT",
  };
}

export function quote039ToPermanent044(q: Quote039, sportKey: string): PermanentQuote044 {
  const sport = sportKind044(sportKey);
  const tax = normalizeMarketType044(q.market, sport);
  const fingerprint = sha(
    [
      "quote",
      q.event_id,
      q.bookmaker,
      q.market,
      q.outcome,
      String(q.price),
      q.available_at ?? "null_avail",
      q.collected_at,
      q.raw_payload_hash,
    ].join("|"),
  );
  return {
    event_id: q.event_id,
    bookmaker: q.bookmaker,
    market: q.market,
    market_group: tax.market_group,
    market_type: tax.market_type,
    selection: q.outcome,
    line: null,
    price: q.price,
    available_at_utc: q.available_at,
    collected_at_utc: q.collected_at,
    source: "lab_a_observation",
    market_available: true,
    fingerprint,
  };
}
