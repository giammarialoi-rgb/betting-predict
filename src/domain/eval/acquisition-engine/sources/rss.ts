/**
 * Public RSS probe — CONTEXT only. Never invents injuries from headlines.
 */
import { loadRssFeed, type RssSourceId } from "@/domain/eval/data-intelligence/research/rss-news";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { freeSourceById } from "@/domain/eval/acquisition-engine/catalog";
import type { SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

const RSS_ENGINE_IDS = [
  "ansa",
  "bbc-sport",
  "guardian-football",
  "gazzetta",
  "sky-sports",
  "espn-soccer-news",
  "corriere-sport",
  "il-messaggero",
] as const;

export function isRssEngineSource(id: string): id is (typeof RSS_ENGINE_IDS)[number] {
  return (RSS_ENGINE_IDS as readonly string[]).includes(id);
}

export async function runAnsaRssLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  xmlText?: string;
  fetchImpl?: typeof fetch;
}): Promise<SourceLaneResult> {
  return runPublicRssLane({ ...input, sourceId: "ansa" });
}

export async function runPublicRssLane(input: {
  sourceId: string;
  url: string;
  nowIso: string;
  persistNeon: boolean;
  xmlText?: string;
  fetchImpl?: typeof fetch;
}): Promise<SourceLaneResult> {
  const sourceId = input.sourceId as RssSourceId;
  const def = freeSourceById(input.sourceId);
  const loaded = await loadRssFeed(sourceId, {
    fetchImpl: input.fetchImpl,
    xmlText: input.xmlText,
  });

  if (loaded.error || loaded.http === 403 || (loaded.http != null && loaded.http >= 400)) {
    const http = loaded.http;
    const status =
      http === 403 ? "BLOCKED" : http === 404 ? "NO_DATA" : "NETWORK_ERROR";
    return emptyLane({
      source_id: input.sourceId,
      url: loaded.url,
      status,
      http_status: http,
      reason: loaded.error ?? `HTTP_${http}`,
      reason_it:
        http === 403
          ? `${def?.title_it ?? input.sourceId} ha restituito HTTP 403. Nessuna notizia utilizzata.`
          : http === 404
            ? `Feed RSS ${def?.title_it ?? input.sourceId} non trovato (HTTP 404). Nessuno scrape della homepage. Nessun infortunio inventato.`
            : `Feed RSS ${def?.title_it ?? input.sourceId} non disponibile. Nessun infortunio inventato.`,
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: input.sourceId,
      name: def?.title ?? input.sourceId,
      licenseClass: "public_endpoint",
    });
  }

  const key = `${input.sourceId.replace(/-/g, "_")}_rss_items`;
  return {
    source_id: input.sourceId,
    ok: loaded.items.length > 0,
    fetched: true,
    status: loaded.items.length > 0 ? "OK" : "NO_DATA",
    http_status: loaded.http,
    url: loaded.url,
    records: [
      {
        source_id: input.sourceId,
        kind: "news",
        feature_key: key,
        value: loaded.items.length,
        event_id: null,
        home: null,
        away: null,
        kickoff_iso: null,
        team_name: null,
        observed_at: input.nowIso,
        available_at: input.nowIso,
        temporal_precision: "exact",
        feature_status: "CONTEXT",
        enters_independent_model: false,
        extraction_method: `${input.sourceId}_public_rss`,
        source_url: loaded.url,
        identity_status: "UNBOUND",
        reason_it: `${loaded.items.length} voci RSS ${def?.title_it ?? input.sourceId}. Solo contesto; nessun infortunio inventato dai titoli.`,
      },
    ],
    fields_extracted: loaded.items.length > 0 ? [key] : [],
    reason: `items=${loaded.items.length}`,
    reason_it: `${def?.title_it ?? input.sourceId}: ${loaded.items.length} voci RSS. Solo contesto.`,
    retries: 0,
    cache_path: null,
    neon,
  };
}
