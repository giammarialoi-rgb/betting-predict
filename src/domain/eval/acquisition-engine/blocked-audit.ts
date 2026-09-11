/**
 * Honest Italian audit for protected / missing free sources.
 * Never implies a scrape succeeded or that a WAF was bypassed.
 */
import {
  BLOCKED_PROTECTED_SOURCES,
  FREE_SOURCE_CATALOG,
} from "@/domain/eval/acquisition-engine/catalog";
import type { SourceLaneResult } from "@/domain/eval/acquisition-engine/types";
import { sourceFailureReasonIt } from "@/domain/eval/betmind-runtime/explain/source-status";

export function blockedProtectedAudit(): Array<{
  source_id: string;
  status: string;
  reason_it: string;
}> {
  return BLOCKED_PROTECTED_SOURCES.map((s) => ({
    source_id: s.source_id,
    status: "BLOCKED",
    reason_it: s.reason_it,
  }));
}

export function laneReasonIt(lane: SourceLaneResult): string {
  const title = FREE_SOURCE_CATALOG.find((s) => s.source_id === lane.source_id)?.title_it ?? lane.source_id;
  if (lane.status === "AUTH_REQUIRED") {
    return lane.reason_it || `${title} richiede autenticazione. Nessun accesso non autorizzato. Nessun dato inventato.`;
  }
  if (lane.status === "BLOCKED" && lane.http_status === 403) {
    return `Abbiamo tentato di consultare ${title}, ma il sito ha restituito HTTP 403. Nessun dato di questa fonte e stato utilizzato.`;
  }
  if (lane.status === "RATE_LIMITED") {
    return `${title} ha limitato le richieste (HTTP 429). Riprovo al ciclo successivo. Nessun hammering.`;
  }
  if (lane.status === "OK" || lane.status === "PARTIAL") {
    return lane.reason_it;
  }
  return sourceFailureReasonIt({
    source_id: lane.source_id,
    ok: lane.ok,
    fetched: lane.fetched,
    phase: lane.status,
    http_status: lane.http_status,
    parser_status: lane.status,
    fields_extracted: lane.fields_extracted,
    reason: lane.reason,
  });
}

export function emptyLane(input: {
  source_id: string;
  url: string;
  status: SourceLaneResult["status"];
  reason: string;
  reason_it: string;
  http_status?: number | null;
  retries?: number;
}): SourceLaneResult {
  return {
    source_id: input.source_id,
    ok: false,
    fetched: false,
    status: input.status,
    http_status: input.http_status ?? null,
    url: input.url,
    records: [],
    fields_extracted: [],
    reason: input.reason,
    reason_it: input.reason_it,
    retries: input.retries ?? 0,
    cache_path: null,
    neon: { source_registered: false, elo_stored: 0, features_stored: 0, reason: null },
  };
}
