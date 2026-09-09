import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { createAllSourceAdapters055 } from "@/services/sources/registry-055";
import { buildUniversalCatalog055, sportFamily055, type UniversalEvent055 } from "@/domain/eval/catalog-055/universal";
import { eventHorizons047 } from "@/domain/eval/factory-047/cycle";
import type { SourceHealth055, SportsSourceId055 } from "@/services/sources/types";

export type MultiSourceCoverage055 = {
  at: string;
  artificial_cap: false;
  catalog_events: number;
  universal_events: number;
  odds_available: number;
  odds_missing: number;
  matched_pairs: number;
  conflicts: number;
  today: number;
  next_24h: number;
  next_72h: number;
  next_7d: number;
  next_30d: number;
  by_sport: Record<string, { catalog: number; odds: number; analyzed: number; missing_odds: number }>;
  source_health: SourceHealth055[];
  predictions: number;
  bet_candidates: number;
  strong_candidates: number;
  no_bet: number;
  watch: number;
  locked: number;
  settled: number;
  autopsies: number;
  learning_cases: number;
  markets: number;
  quotes: number;
  snapshots: number;
  current_activity: {
    phase: string;
    source: string;
    sport: string | null;
    events_processed: number;
    events_remaining: number;
    started_at: string;
    note: string;
  };
};

function dir055(root: string): string {
  return join(root, "catalog-055");
}

export function ensureCatalogDirs055(root = permanentRoot044()): void {
  mkdirSync(dir055(root), { recursive: true });
  mkdirSync(join(dir055(root), "raw"), { recursive: true });
}

export function appendActivity055(root: string, kind: string, summary: string, extra: Record<string, unknown> = {}): void {
  ensureCatalogDirs055(root);
  appendJsonl044(join(dir055(root), "activity-feed.jsonl"), {
    at: new Date().toISOString(),
    kind,
    summary,
    ...extra,
  });
}

export function writeActivity055(root: string, activity: MultiSourceCoverage055["current_activity"]): void {
  ensureCatalogDirs055(root);
  writeFileSync(join(dir055(root), "current-activity.json"), JSON.stringify(activity, null, 2));
}

export async function runMultiSourceCycle055(input: { nowIso?: string } = {}): Promise<MultiSourceCoverage055> {
  const root = permanentRoot044();
  ensureCatalogDirs055(root);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const started = nowIso;

  writeActivity055(root, {
    phase: "DISCOVER",
    source: "MULTI",
    sport: null,
    events_processed: 0,
    events_remaining: 0,
    started_at: started,
    note: "multi-source discovery",
  });

  const adapters = createAllSourceAdapters055();
  const health: SourceHealth055[] = [];
  const batches: { source: SportsSourceId055; events: Awaited<ReturnType<(typeof adapters)[0]["discoverEvents"]>>["events"] }[] = [];

  for (const a of adapters) {
    writeActivity055(root, {
      phase: "DISCOVER",
      source: a.sourceId,
      sport: null,
      events_processed: 0,
      events_remaining: 0,
      started_at: started,
      note: `discover ${a.sourceId}`,
    });
    const h = a.health();
    health.push(h);
    appendActivity055(root, "DISCOVERY", `${a.sourceId} status=${h.status}`, { reason: h.reason });
    try {
      const disc = await a.discoverEvents(
        // Odds: full disk catalog (no artificial cap). Policy stubs: still call discover (empty).
        a.sourceId === "THE_ODDS_API" ? undefined : { horizon: "NEXT_7D" },
      );
      batches.push({ source: a.sourceId, events: disc.events });
      appendActivity055(root, "EVENT_FOUND", `${a.sourceId} events=${disc.events.length} status=${disc.status}`);
      appendJsonl044(join(dir055(root), "raw", `${a.sourceId.toLowerCase()}-discovery.jsonl`), {
        source: a.sourceId,
        at: nowIso,
        status: disc.status,
        events: disc.events.length,
        available_at: nowIso,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendActivity055(root, "SOURCE_ERROR", `${a.sourceId} ${msg}`);
      // continue — source failure must not stop pipeline
      batches.push({ source: a.sourceId, events: [] });
    }
  }

  writeActivity055(root, {
    phase: "NORMALIZE",
    source: "MULTI",
    sport: null,
    events_processed: 0,
    events_remaining: 0,
    started_at: started,
    note: "universal match",
  });

  const { universals, conflicts, matched_pairs } = buildUniversalCatalog055(batches, nowIso);
  appendActivity055(root, "SOURCE_MATCH", `universals=${universals.length} matched_pairs=${matched_pairs} conflicts=${conflicts}`);

  // Persist universal map append-only (dedupe by universal_event_id last-wins file rewrite for snapshot)
  writeFileSync(join(dir055(root), "universal-events.json"), JSON.stringify(universals, null, 2));
  for (const u of universals) {
    appendJsonl044(join(dir055(root), "universal-events.jsonl"), u);
  }

  const store = loadStore044(root);
  const uniqueOdds = new Set(store.events.map((e) => e.event_id));
  const horizons = eventHorizons047(root, Date.parse(nowIso));
  const nowMs = Date.parse(nowIso);
  let next30 = 0;
  for (const e of store.events) {
    if (!e.kickoff_utc) continue;
    const d = Date.parse(e.kickoff_utc) - nowMs;
    if (d >= -2 * 3600_000 && d <= 30 * 86400_000) next30 += 1;
  }
  // unique for next30
  const seen30 = new Set<string>();
  for (const e of store.events) {
    if (!e.kickoff_utc) continue;
    const d = Date.parse(e.kickoff_utc) - nowMs;
    if (d >= -2 * 3600_000 && d <= 30 * 86400_000) seen30.add(e.event_id);
  }
  next30 = seen30.size;

  const bySport: MultiSourceCoverage055["by_sport"] = {};
  for (const u of universals) {
    const fam = sportFamily055(u.sport);
    if (!bySport[fam]) bySport[fam] = { catalog: 0, odds: 0, analyzed: 0, missing_odds: 0 };
    bySport[fam].catalog += 1;
    if (u.odds_status === "ODDS_AVAILABLE") bySport[fam].odds += 1;
    else bySport[fam].missing_odds += 1;
  }

  const predByEvent = new Map<string, (typeof store.predictions)[0]>();
  for (const p of store.predictions) predByEvent.set(p.event_id, p);
  for (const fam of Object.keys(bySport)) {
    bySport[fam]!.analyzed = [...uniqueOdds].filter((id) => {
      const ev = store.events.find((e) => e.event_id === id);
      return ev && sportFamily055(ev.sport) === fam && predByEvent.has(id);
    }).length;
  }

  let bet = 0;
  let strong = 0;
  let noBet = 0;
  for (const p of predByEvent.values()) {
    if (p.recommended) {
      bet += 1;
      if ((p.confidence_score ?? 0) >= 0.75) strong += 1;
    } else {
      noBet += 1;
    }
  }

  const markets = new Set(store.quotes.map((q) => q.market)).size;
  let snapshots = 0;
  const snapPath = join(root, "snapshots.jsonl");
  if (existsSync(snapPath)) {
    snapshots = readFileSync(snapPath, "utf8").split(/\n/).filter(Boolean).length;
  }

  // Update health with matched counts from this cycle
  const enrichedHealth = health.map((h) => {
    const batch = batches.find((b) => b.source === h.sourceId);
    return {
      ...h,
      events_discovered: batch?.events.length ?? h.events_discovered,
      events_matched: h.sourceId === "THE_ODDS_API" ? uniqueOdds.size : 0,
    };
  });

  writeActivity055(root, {
    phase: "IDLE",
    source: "MULTI",
    sport: null,
    events_processed: universals.length,
    events_remaining: 0,
    started_at: started,
    note: "multi-source cycle complete",
  });
  appendActivity055(root, "ANALYSIS", `universals=${universals.length} predictions=${predByEvent.size}`);
  appendActivity055(root, "DECISION", `BET=${bet} NO_BET=${noBet} STRONG=${strong}`);

  const coverage: MultiSourceCoverage055 = {
    at: nowIso,
    artificial_cap: false,
    catalog_events: universals.length,
    universal_events: universals.length,
    odds_available: universals.filter((u) => u.odds_status === "ODDS_AVAILABLE").length,
    odds_missing: universals.filter((u) => u.odds_status === "ODDS_MISSING").length,
    matched_pairs,
    conflicts,
    today: horizons.TODAY,
    next_24h: horizons.NEXT_24H,
    next_72h: horizons.NEXT_72H,
    next_7d: horizons.NEXT_7D,
    next_30d: next30,
    by_sport: bySport,
    source_health: enrichedHealth,
    predictions: predByEvent.size,
    bet_candidates: bet,
    strong_candidates: strong,
    no_bet: noBet,
    watch: 0,
    locked: store.lockEventIds.size,
    settled: store.settlements.length,
    autopsies: store.autopsies.length,
    learning_cases: store.learning.length,
    markets,
    quotes: store.quotes.length,
    snapshots,
    current_activity: {
      phase: "IDLE",
      source: "MULTI",
      sport: null,
      events_processed: universals.length,
      events_remaining: 0,
      started_at: started,
      note: "ok",
    },
  };

  writeFileSync(join(dir055(root), "coverage.json"), JSON.stringify(coverage, null, 2));
  writeFileSync(join(dir055(root), "source-health.json"), JSON.stringify(enrichedHealth, null, 2));
  return coverage;
}

export function loadCoverage055(root = permanentRoot044()): MultiSourceCoverage055 | null {
  const p = join(dir055(root), "coverage.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as MultiSourceCoverage055;
}

export function loadCurrentActivity055(root = permanentRoot044()) {
  const p = join(dir055(root), "current-activity.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as MultiSourceCoverage055["current_activity"];
}

export function readActivityFeed055(root = permanentRoot044(), limit = 80) {
  const p = join(dir055(root), "activity-feed.jsonl");
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
    .filter(Boolean) as { at: string; kind: string; summary: string }[];
}

export function loadUniversals055(root = permanentRoot044()): UniversalEvent055[] {
  const p = join(dir055(root), "universal-events.json");
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as UniversalEvent055[];
}
