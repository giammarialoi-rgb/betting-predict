/**
 * Public RSS probe — CONTEXT only. Never invents injuries from headlines.
 */
import { loadRssFeed } from "@/domain/eval/data-intelligence/research/rss-news";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { ensureAcquisitionDataSource } from "@/domain/eval/acquisition-engine/persist";
import type { SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

export async function runAnsaRssLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  xmlText?: string;
  fetchImpl?: typeof fetch;
}): Promise<SourceLaneResult> {
  const loaded = await loadRssFeed("ansa", {
    fetchImpl: input.fetchImpl,
    xmlText: input.xmlText,
  });

  if (loaded.error || loaded.http === 403) {
    return emptyLane({
      source_id: "ansa",
      url: loaded.url,
      status: loaded.http === 403 ? "BLOCKED" : "NETWORK_ERROR",
      http_status: loaded.http,
      reason: loaded.error ?? `HTTP_${loaded.http}`,
      reason_it:
        loaded.http === 403
          ? "ANSA ha restituito HTTP 403. Nessuna notizia utilizzata."
          : "Feed RSS ANSA non disponibile. Nessun infortunio inventato.",
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    try {
      const id = await ensureAcquisitionDataSource({
        slug: "ansa",
        name: "ANSA Calcio RSS",
        licenseClass: "public_endpoint",
      });
      neon = {
        source_registered: Boolean(id),
        elo_stored: 0,
        features_stored: 0,
        reason: id ? null : "DATABASE_URL not set or insert failed",
      };
    } catch (e) {
      neon.reason = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    source_id: "ansa",
    ok: loaded.items.length > 0,
    fetched: true,
    status: loaded.items.length > 0 ? "OK" : "NO_DATA",
    http_status: loaded.http,
    url: loaded.url,
    records: [
      {
        source_id: "ansa",
        kind: "news",
        feature_key: "ansa_rss_items",
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
        extraction_method: "ansa_public_rss",
        source_url: loaded.url,
        identity_status: "UNBOUND",
        reason_it: `${loaded.items.length} voci RSS ANSA. Solo contesto; nessun infortunio inventato dai titoli.`,
      },
    ],
    fields_extracted: loaded.items.length > 0 ? ["ansa_rss_items"] : [],
    reason: `items=${loaded.items.length}`,
    reason_it: `ANSA RSS: ${loaded.items.length} voci. Solo contesto.`,
    retries: 0,
    cache_path: null,
    neon,
  };
}
