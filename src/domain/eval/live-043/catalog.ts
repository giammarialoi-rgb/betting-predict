import { createHash } from "node:crypto";
import type { Event039 } from "@/domain/eval/live-039/types";
import { sportKind043 } from "@/domain/eval/live-043/config";
import type { CatalogEvent043 } from "@/domain/eval/live-043/types";
import { upsertCatalog043, type Store043 } from "@/domain/eval/live-043/store";

export function stableEventKey043(ev: {
  source: string;
  source_event_id: string;
  sport_key: string;
}): string {
  return createHash("sha256")
    .update([ev.source, ev.sport_key, ev.source_event_id].join("|"))
    .digest("hex")
    .slice(0, 32);
}

export function catalogFromEvent039(ev: Event039, discoveredAt: string): CatalogEvent043 {
  const sport = sportKind043(ev.sport_key);
  return {
    event_id: ev.event_id,
    sport,
    competition: ev.sport_key,
    country: null,
    season: null,
    home_or_a: ev.home_team,
    away_or_b: ev.away_team,
    commence_time: ev.commence_time,
    status: ev.kickoff_status === "OK" ? "SCHEDULED" : "INVALID_KICKOFF",
    source: ev.source,
    discovered_at: discoveredAt,
    event_source_id: ev.source_event_id,
    stable_key: stableEventKey043({
      source: ev.source,
      source_event_id: ev.source_event_id,
      sport_key: ev.sport_key,
    }),
  };
}

export function syncCatalogFrom039(store043: Store043, events: readonly Event039[], nowIso: string): {
  inserted: number;
  touched: number;
} {
  let inserted = 0;
  let touched = 0;
  for (const ev of events) {
    const r = upsertCatalog043(store043, catalogFromEvent039(ev, nowIso));
    if (r === "inserted") inserted += 1;
    else touched += 1;
  }
  return { inserted, touched };
}
