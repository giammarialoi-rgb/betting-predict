import { createHash } from "node:crypto";
import { matchEvents054, normalizeParticipant054, detectKickoffConflict054 } from "@/domain/eval/catalog-054/matching";
import type { SourceEvent055, SportsSourceId055 } from "@/services/sources/types";

export type UniversalEvent055 = {
  universal_event_id: string;
  event_id: string | null;
  source_ids: SportsSourceId055[];
  source_event_ids: { source: SportsSourceId055; id: string }[];
  sport: string;
  competition: string | null;
  country: string | null;
  home: string;
  away: string;
  commence_time: string | null;
  source_kickoff: { source: SportsSourceId055; kickoff: string | null }[];
  match_confidence: number;
  match_class: string;
  first_seen_at: string;
  last_seen_at: string;
  odds_status: "ODDS_AVAILABLE" | "ODDS_MISSING" | "PARTIAL_ODDS";
};

function fingerprintSeed(e: SourceEvent055): string {
  const h = normalizeParticipant054(e.home);
  const a = normalizeParticipant054(e.away);
  const ko = (e.commence_time ?? "").slice(0, 13);
  return `${e.sport.toLowerCase()}|${[h, a].sort().join("|")}|${ko}`;
}

export function universalEventId055(e: SourceEvent055): string {
  return createHash("sha256").update(fingerprintSeed(e)).digest("hex").slice(0, 24);
}

/** Merge SourceEvents across adapters into UniversalEvents — never overwrite conflicting kickoffs. */
export function buildUniversalCatalog055(
  batches: { source: SportsSourceId055; events: SourceEvent055[] }[],
  nowIso: string,
): { universals: UniversalEvent055[]; conflicts: number; matched_pairs: number } {
  const universals: UniversalEvent055[] = [];
  let conflicts = 0;
  let matched_pairs = 0;

  for (const batch of batches) {
    for (const ev of batch.events) {
      let bestIdx = -1;
      let bestScore = 0;
      let bestClass = "MATCH_UNMATCHED";
      for (let i = 0; i < universals.length; i++) {
        const u = universals[i]!;
        const m = matchEvents054({
          sport_a: u.sport,
          sport_b: ev.sport,
          p1_a: u.home,
          p2_a: u.away,
          p1_b: ev.home,
          p2_b: ev.away,
          kickoff_a: u.commence_time,
          kickoff_b: ev.commence_time,
          competition_a: u.competition,
          competition_b: ev.competition,
        });
        if (m.match_score > bestScore) {
          bestScore = m.match_score;
          bestIdx = i;
          bestClass = m.class;
        }
      }

      if (bestIdx >= 0 && (bestClass === "MATCH_EXACT" || bestClass === "MATCH_HIGH_CONFIDENCE")) {
        matched_pairs += 1;
        const u = universals[bestIdx]!;
        const c = detectKickoffConflict054(u.source_ids[0] ?? "OTHER", u.commence_time, ev.source_id, ev.commence_time, nowIso);
        if (c) conflicts += 1;
        if (!u.source_ids.includes(ev.source_id)) u.source_ids.push(ev.source_id);
        u.source_event_ids.push({ source: ev.source_id, id: ev.source_event_id });
        u.source_kickoff.push({ source: ev.source_id, kickoff: ev.commence_time });
        u.last_seen_at = nowIso;
        u.match_confidence = Math.max(u.match_confidence, bestScore);
        u.match_class = bestClass;
        if (ev.source_id === "THE_ODDS_API") {
          u.event_id = ev.source_event_id;
          u.odds_status = "ODDS_AVAILABLE";
        }
      } else {
        const uid = universalEventId055(ev);
        universals.push({
          universal_event_id: uid,
          event_id: ev.source_id === "THE_ODDS_API" ? ev.source_event_id : null,
          source_ids: [ev.source_id],
          source_event_ids: [{ source: ev.source_id, id: ev.source_event_id }],
          sport: ev.sport,
          competition: ev.competition,
          country: ev.country,
          home: ev.home,
          away: ev.away,
          commence_time: ev.commence_time,
          source_kickoff: [{ source: ev.source_id, kickoff: ev.commence_time }],
          match_confidence: 1,
          match_class: "MATCH_EXACT",
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          odds_status: ev.source_id === "THE_ODDS_API" ? "ODDS_AVAILABLE" : "ODDS_MISSING",
        });
      }
    }
  }

  return { universals, conflicts, matched_pairs };
}

export function sportFamily055(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes("soccer") || (s.includes("football") && !s.includes("american"))) return "soccer";
  if (s.includes("tennis")) return "tennis";
  if (s.includes("basket")) return "basketball";
  if (s.includes("volley")) return "volleyball";
  if (s.includes("hockey")) return "hockey";
  if (s.includes("baseball")) return "baseball";
  if (s.includes("rugby")) return "rugby";
  if (s.includes("handball")) return "handball";
  if (s.includes("american")) return "american_football";
  return "other";
}
