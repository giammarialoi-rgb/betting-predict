import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { createDirectaAdapter054 } from "@/services/sources/directa";
import { matchEvents054, detectKickoffConflict054, type Conflict054 } from "@/domain/eval/catalog-054/matching";
import { eventHorizons047 } from "@/domain/eval/factory-047/cycle";

export type OddsAvailability054 = "ODDS_AVAILABLE" | "ODDS_MISSING" | "PARTIAL_ODDS" | "SOURCE_CONFLICT" | "MATCH_UNCERTAIN";

export type CatalogCoverage054 = {
  at: string;
  directa_status: string;
  directa_policy_status: string;
  catalog_events: number;
  odds_events: number;
  analyzed_events: number;
  matched: number;
  unmatched: number;
  conflicts: number;
  odds_available: number;
  odds_missing: number;
  today: number;
  next_24h: number;
  next_72h: number;
  next_7d: number;
  by_sport: Record<string, { catalog: number; odds: number; missing_odds: number }>;
  sources: {
    DIRECTA: { events: number; status: string; last_error: string | null };
    ODDS_API: { events: number; status: string; last_error: string | null };
    FOOTBALL_DATA: { events: number; status: string; last_error: string | null };
    OTHER: { events: number; status: string; last_error: string | null };
  };
  current_activity: {
    phase: string;
    source: string;
    sport: string | null;
    events_processed: number;
    events_remaining: number;
    started_at: string;
    note: string;
  };
  artificial_cap: false;
};

function catalogDir(root: string): string {
  return join(root, "catalog-054");
}

export function ensureCatalogDirs054(root = permanentRoot044()): void {
  mkdirSync(catalogDir(root), { recursive: true });
  mkdirSync(join(catalogDir(root), "raw"), { recursive: true });
}

export function writeCurrentActivity054(
  root: string,
  activity: CatalogCoverage054["current_activity"],
): void {
  ensureCatalogDirs054(root);
  writeFileSync(join(catalogDir(root), "current-activity.json"), JSON.stringify(activity, null, 2));
}

export function appendActivityFeed054(root: string, kind: string, summary: string, extra: Record<string, unknown> = {}): void {
  ensureCatalogDirs054(root);
  appendJsonl044(join(catalogDir(root), "activity-feed.jsonl"), {
    at: new Date().toISOString(),
    kind,
    summary,
    ...extra,
  });
}

/** Build catalog coverage from Lab B odds store + Directa adapter (policy-gated). */
export async function runCatalogCycle054(input: {
  nowIso?: string;
} = {}): Promise<CatalogCoverage054> {
  const root = permanentRoot044();
  ensureCatalogDirs054(root);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const started = nowIso;

  writeCurrentActivity054(root, {
    phase: "DISCOVERING",
    source: "DIRECTA",
    sport: null,
    events_processed: 0,
    events_remaining: 0,
    started_at: started,
    note: "policy check",
  });

  const directa = createDirectaAdapter054();
  const health = directa.health();
  appendActivityFeed054(root, "DIRECTA_HEALTH", health.policy_status, { reason: health.reason });

  const disc = await directa.discoverEvents({ horizon: "NEXT_7D" });
  appendActivityFeed054(root, "DIRECTA_DISCOVERY", `events=${disc.events.length} status=${disc.status}`);

  writeCurrentActivity054(root, {
    phase: "MATCH",
    source: "ODDS_API",
    sport: "ALL",
    events_processed: 0,
    events_remaining: 0,
    started_at: started,
    note: "triangulate catalog ↔ odds",
  });

  const store = loadStore044(root);
  const uniqueOdds = new Map<string, (typeof store.events)[0]>();
  for (const e of store.events) uniqueOdds.set(e.event_id, e);

  const oddsEvents = [...uniqueOdds.values()];
  const horizons = eventHorizons047(root, Date.parse(nowIso));

  // Match Directa catalog (empty when disabled) against odds events
  let matched = 0;
  let unmatched = disc.events.length;
  const conflicts: Conflict054[] = [];
  for (const ce of disc.events) {
    let best = null as ReturnType<typeof matchEvents054> | null;
    for (const oe of oddsEvents) {
      const m = matchEvents054({
        sport_a: ce.sport,
        sport_b: oe.sport,
        p1_a: ce.participant_1,
        p2_a: ce.participant_2,
        p1_b: oe.home_or_a,
        p2_b: oe.away_or_b,
        kickoff_a: ce.kickoff_utc,
        kickoff_b: oe.kickoff_utc,
        competition_a: ce.competition,
        competition_b: oe.competition,
      });
      if (!best || m.match_score > best.match_score) best = m;
      const c = detectKickoffConflict054("DIRECTA", ce.kickoff_utc, "ODDS_API", oe.kickoff_utc, nowIso);
      if (c && m.class !== "MATCH_UNMATCHED") conflicts.push(c);
    }
    if (best && (best.class === "MATCH_EXACT" || best.class === "MATCH_HIGH_CONFIDENCE")) {
      matched += 1;
      unmatched -= 1;
      appendJsonl044(join(catalogDir(root), "source-event-map.jsonl"), {
        canonical_event_id: best.canonical_event_id,
        directa_id: ce.source_event_id,
        match_class: best.class,
        match_score: best.match_score,
        at: nowIso,
      });
    }
  }

  // Persist Directa empty discovery fingerprint for audit trail
  const rawHash = createHash("sha256")
    .update(JSON.stringify({ status: disc.status, n: disc.events.length, at: nowIso }))
    .digest("hex");
  appendJsonl044(join(catalogDir(root), "raw", "directa-discovery.jsonl"), {
    source: "DIRECTA",
    endpoint: "discoverEvents",
    request_time: nowIso,
    response_time: nowIso,
    http_status: health.policy_status === "DISABLED_BY_POLICY" ? 0 : null,
    content_hash: rawHash,
    payload_hash: rawHash,
    available_at: nowIso,
    status: disc.status,
    events: disc.events.length,
  });

  for (const c of conflicts) {
    appendJsonl044(join(catalogDir(root), "conflicts.jsonl"), c);
  }

  const bySport: CatalogCoverage054["by_sport"] = {};
  for (const e of oddsEvents) {
    const s = (e.sport || "other").toLowerCase();
    const key = s.includes("soccer") || s.includes("football")
      ? "soccer"
      : s.includes("tennis")
        ? "tennis"
        : s.includes("basket")
          ? "basketball"
          : s.includes("volley")
            ? "volleyball"
            : s.includes("hockey")
              ? "hockey"
              : "other";
    if (!bySport[key]) bySport[key] = { catalog: 0, odds: 0, missing_odds: 0 };
    bySport[key].odds += 1;
    bySport[key].catalog += 1; // odds-backed catalog rows when Directa disabled
  }

  // Union catalog: odds events + Directa-only (unmatched). Never drop odds-missing rows.
  const catalogEvents = oddsEvents.length + Math.max(0, unmatched);
  const predicted = new Set(store.predictions.map((p) => p.event_id)).size;
  const oddsMissing = Math.max(0, unmatched);

  appendActivityFeed054(
    root,
    "MATCH",
    `Directa ↔ OddsAPI matched=${matched} unmatched=${unmatched} conflicts=${conflicts.length}`,
  );
  appendActivityFeed054(root, "COVERAGE", `catalog=${catalogEvents} odds=${oddsEvents.length}`);

  writeCurrentActivity054(root, {
    phase: "IDLE",
    source: "MULTI",
    sport: null,
    events_processed: oddsEvents.length,
    events_remaining: 0,
    started_at: started,
    note: health.policy_status === "DISABLED_BY_POLICY" ? "Directa disabled — odds catalog active" : "ok",
  });

  const coverage: CatalogCoverage054 = {
    at: nowIso,
    directa_status: disc.status,
    directa_policy_status: health.policy_status,
    catalog_events: catalogEvents,
    odds_events: oddsEvents.length,
    analyzed_events: predicted,
    matched,
    unmatched: Math.max(0, unmatched),
    conflicts: conflicts.length,
    odds_available: oddsEvents.length,
    odds_missing: oddsMissing,
    today: horizons.TODAY,
    next_24h: horizons.NEXT_24H,
    next_72h: horizons.NEXT_72H,
    next_7d: horizons.NEXT_7D,
    by_sport: bySport,
    sources: {
      DIRECTA: {
        events: disc.events.length,
        status: health.policy_status,
        last_error: health.reason,
      },
      ODDS_API: {
        events: oddsEvents.length,
        status: oddsEvents.length ? "ACTIVE_DATA" : "ACTIVE_EMPTY",
        last_error: null,
      },
      FOOTBALL_DATA: {
        events: 0,
        status: "UNAVAILABLE",
        last_error: "adapter reserved — not wired in TASK 054 live path",
      },
      OTHER: {
        events: 0,
        status: "EMPTY",
        last_error: null,
      },
    },
    current_activity: {
      phase: "IDLE",
      source: "MULTI",
      sport: null,
      events_processed: oddsEvents.length,
      events_remaining: 0,
      started_at: started,
      note: health.reason,
    },
    artificial_cap: false,
  };

  writeFileSync(join(catalogDir(root), "coverage.json"), JSON.stringify(coverage, null, 2));
  return coverage;
}

export function loadCoverage054(root = permanentRoot044()): CatalogCoverage054 | null {
  const p = join(catalogDir(root), "coverage.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as CatalogCoverage054;
}

export function loadCurrentActivity054(root = permanentRoot044()): CatalogCoverage054["current_activity"] | null {
  const p = join(catalogDir(root), "current-activity.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as CatalogCoverage054["current_activity"];
}

export function readCatalogActivity054(root = permanentRoot044(), limit = 40) {
  const p = join(catalogDir(root), "activity-feed.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .slice(-limit)
    .reverse()
    .map((l) => {
      try {
        return JSON.parse(l) as { at: string; kind: string; summary: string };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
