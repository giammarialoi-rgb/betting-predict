/**
 * ANALYZED board / next_events metadata derived from a real analysis_dossier.
 * Never synthesizes a dossier from a board row.
 */
import { calendarDayKey } from "@/domain/eval/betmind-runtime/calendar";
import type { BoardEventMirrorRow } from "@/domain/storage/types";

export type AnalyzedDossierLike = {
  event: {
    event_id: string;
    home: string;
    away: string;
    competition: string;
    kickoff_utc: string | null;
    sport: string;
    status?: string;
  };
  independent_model?: {
    probability?: Record<string, number> | null;
    model_version?: string | null;
    feature_coverage?: number | null;
    decision?: string | null;
  } | null;
  analyzed_at?: string | null;
};

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Local unwrap — keep this file free of remote-mirror imports (cycle). */
export function unwrapEventLike(row: unknown): Record<string, unknown> | null {
  const rec = asRec(row);
  if (!rec) return null;
  let payload: Record<string, unknown>;
  if (typeof rec.payload === "string") {
    try {
      payload = JSON.parse(rec.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  } else if (asRec(rec.payload)) {
    payload = rec.payload as Record<string, unknown>;
  } else {
    payload = rec;
  }
  const eventId = String(rec.event_id || payload.event_id || "");
  if (!eventId) return null;
  return {
    ...payload,
    event_id: eventId,
    bucket: rec.bucket ?? payload.bucket ?? null,
    published_at: rec.published_at ?? payload.published_at ?? null,
  };
}

function pickAnalyzedFields(src: Record<string, unknown>): Record<string, unknown> {
  return {
    bucket: "ANALYZED",
    dossier_present: true,
    label: src.label ?? null,
    model_version: src.model_version ?? null,
    decision: src.decision ?? null,
    probability_model: src.probability_model ?? null,
    analyzed_at: src.analyzed_at ?? null,
    prediction_status: src.prediction_status ?? null,
    feature_coverage: src.feature_coverage ?? null,
  };
}

export function isAnalyzedBoardLike(row: unknown): boolean {
  const ev = unwrapEventLike(row);
  if (!ev) return false;
  return String(ev.bucket ?? "").toUpperCase() === "ANALYZED" || ev.dossier_present === true;
}

export function analyzedBoardPayloadFromDossier(
  dossier: AnalyzedDossierLike,
  publishedAt: string,
): Record<string, unknown> {
  const event = dossier.event;
  const im = dossier.independent_model;
  const kickoff = event.kickoff_utc ?? null;
  return {
    event_id: event.event_id,
    label: `${event.home} vs ${event.away}`,
    home_or_a: event.home,
    away_or_b: event.away,
    competition: event.competition,
    kickoff_utc: kickoff,
    calendar_day: calendarDayKey(kickoff),
    sport: event.sport,
    status: event.status ?? "UPCOMING",
    bucket: "ANALYZED",
    model_version: im?.model_version ?? null,
    feature_coverage: im?.feature_coverage ?? null,
    decision: im?.decision ?? null,
    prediction_status: im?.probability ? "PREDICTION" : "NO_PREDICTION",
    probability_model: im?.probability ?? null,
    analyzed_at: dossier.analyzed_at ?? null,
    dossier_present: true,
    real_money: false,
    published_at: publishedAt,
  };
}

export function analyzedBoardRowFromDossier(
  dossier: AnalyzedDossierLike,
  publishedAt: string,
): BoardEventMirrorRow {
  const payload = analyzedBoardPayloadFromDossier(dossier, publishedAt);
  return {
    event_id: String(payload.event_id),
    bucket: "ANALYZED",
    published_at: publishedAt,
    payload,
  };
}

export function overlayAnalyzedBoardRow(
  incoming: BoardEventMirrorRow,
  analyzed: BoardEventMirrorRow,
): BoardEventMirrorRow {
  const inc = unwrapEventLike(incoming) ?? {};
  const ana = unwrapEventLike(analyzed) ?? {};
  return {
    event_id: incoming.event_id,
    bucket: "ANALYZED",
    published_at: analyzed.published_at || incoming.published_at,
    payload: {
      ...inc,
      ...pickAnalyzedFields(ana),
      event_id: incoming.event_id,
      bucket: "ANALYZED",
      dossier_present: true,
    },
  };
}

/**
 * Incoming board wins for the same id, except ANALYZED rows on the remote
 * artifact are never dropped or downgraded to DISCOVERED.
 */
export function mergeBoardEventsPreservingAnalyzed(
  existing: BoardEventMirrorRow[] | undefined,
  incoming: BoardEventMirrorRow[] | undefined,
): BoardEventMirrorRow[] {
  const incomingArr = incoming ?? [];
  const existingArr = existing ?? [];
  if (!incomingArr.length) return existingArr;
  const by = new Map<string, BoardEventMirrorRow>();
  for (const row of incomingArr) {
    if (row?.event_id) by.set(row.event_id, row);
  }
  for (const row of existingArr) {
    if (!row?.event_id) continue;
    const cur = by.get(row.event_id);
    if (!cur) {
      if (isAnalyzedBoardLike(row)) by.set(row.event_id, row);
      continue;
    }
    if (isAnalyzedBoardLike(row) && !isAnalyzedBoardLike(cur)) {
      by.set(row.event_id, overlayAnalyzedBoardRow(cur, row));
    } else if (
      isAnalyzedBoardLike(cur) &&
      isAnalyzedBoardLike(row) &&
      String(row.published_at ?? "") > String(cur.published_at ?? "")
    ) {
      by.set(row.event_id, row);
    }
  }
  return [...by.values()];
}

export function mergeNextEventsPreservingAnalyzed(
  existing: unknown,
  incoming: unknown,
): unknown[] {
  const incomingArr = Array.isArray(incoming) ? incoming : [];
  const existingArr = Array.isArray(existing) ? existing : [];
  if (!incomingArr.length) return existingArr;
  const by = new Map<string, Record<string, unknown>>();
  for (const raw of incomingArr) {
    const ev = unwrapEventLike(raw);
    if (ev) by.set(String(ev.event_id), ev);
  }
  for (const raw of existingArr) {
    const ev = unwrapEventLike(raw);
    if (!ev) continue;
    const id = String(ev.event_id);
    const cur = by.get(id);
    if (!cur) {
      if (isAnalyzedBoardLike(ev)) by.set(id, ev);
      continue;
    }
    if (isAnalyzedBoardLike(ev) && !isAnalyzedBoardLike(cur)) {
      by.set(id, {
        ...cur,
        ...pickAnalyzedFields(ev),
        event_id: id,
        bucket: "ANALYZED",
        dossier_present: true,
      });
    }
  }
  return [...by.values()];
}

/** Keep next_events in lockstep with ANALYZED board rows. */
export function overlayAnalyzedBoardOntoEvents(
  events: unknown[],
  board: BoardEventMirrorRow[],
): unknown[] {
  const analyzed = board
    .filter((row) => isAnalyzedBoardLike(row))
    .map((row) => unwrapEventLike(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  if (!analyzed.length) return events;
  const by = new Map<string, Record<string, unknown>>();
  for (const raw of events) {
    const ev = unwrapEventLike(raw);
    if (ev) by.set(String(ev.event_id), ev);
  }
  for (const ev of analyzed) {
    const id = String(ev.event_id ?? "");
    if (!id) continue;
    const prev = by.get(id);
    if (!prev) by.set(id, ev);
    else {
      by.set(id, {
        ...prev,
        ...pickAnalyzedFields(ev),
        event_id: id,
        bucket: "ANALYZED",
        dossier_present: true,
      });
    }
  }
  return [...by.values()];
}

export function analyzedEventFromDossierRow(row: {
  event_id: string;
  published_at: string;
  dossier: Record<string, unknown>;
}): Record<string, unknown> | null {
  const dossier = row.dossier as unknown as AnalyzedDossierLike;
  if (!dossier?.event?.event_id) return null;
  return analyzedBoardPayloadFromDossier(dossier, row.published_at);
}

/**
 * Eventi listing overlay: union board/next_events with dossier metadata.
 * Does not invent a dossier. Does not drop other events.
 */
export function overlayAnalyzedDossierPayloadsOntoEvents(
  events: unknown[],
  extras: Record<string, unknown>[],
): unknown[] {
  if (!extras.length) return events;
  const by = new Map<string, Record<string, unknown>>();
  for (const raw of events) {
    const ev = unwrapEventLike(raw);
    if (ev) by.set(String(ev.event_id), ev);
  }
  for (const ev of extras) {
    const id = String(ev.event_id ?? "");
    if (!id) continue;
    const prev = by.get(id);
    if (!prev) by.set(id, ev);
    else {
      by.set(id, {
        ...prev,
        ...pickAnalyzedFields(ev),
        event_id: id,
        bucket: "ANALYZED",
        dossier_present: true,
        label: ev.label ?? prev.label,
        kickoff_utc: prev.kickoff_utc ?? ev.kickoff_utc,
        calendar_day: prev.calendar_day ?? ev.calendar_day,
      });
    }
  }
  return [...by.values()];
}
