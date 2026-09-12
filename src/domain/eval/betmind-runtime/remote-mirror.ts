/**
 * Durable Vercel runtime mirror — no Neon.
 *
 * Store choice: one JSON artifact in Vercel Blob (`@vercel/blob`) at
 * `betmind/runtime-mirror.json`. Blob survives serverless cold starts.
 * In-memory is test-only. Ephemeral FS on Vercel is not the remote SoT.
 *
 * If BLOB_READ_WRITE_TOKEN (or OIDC + BLOB_STORE_ID) is missing, Vercel
 * stays local-only: ingest returns 503 and Control Center stays OFFLINE.
 * DATABASE_URL is ignored.
 */
import { timingSafeEqual } from "node:crypto";
import type { BoardEventMirrorRow, LiveStateMirrorRow } from "@/domain/storage/types";
import { NEON_IN_USE } from "@/domain/storage/neon-ban";
import {
  collectLiveRows,
  latestLiveTimestamp,
  overlayLiveOnEvents,
} from "@/domain/eval/betmind-runtime/live-state";

/** Structural payload — avoid importing remote-status (cycle). */
export type RuntimeIngestPayload = {
  published_at: string;
  components: Record<string, unknown>;
  observatory?: { next_events?: unknown[] } | null;
  store_present_local?: boolean;
  host?: string;
  [key: string]: unknown;
};

export const REMOTE_MIRROR_PATHNAME = "betmind/runtime-mirror.json";
export const REMOTE_MIRROR_SCHEMA = "betmind-remote-mirror/1" as const;

export type RemoteMirrorBackend = "vercel_blob" | "memory" | "none";

/** Compact analysis_dossier row on the remote artifact. Never a board_summary. */
export type RemoteDossierMirrorRow = {
  event_id: string;
  published_at: string;
  dossier: Record<string, unknown>;
  dossier_version: string | null;
};

export type RemoteKeyedSliceRow = {
  event_id: string;
  published_at: string;
  payload: Record<string, unknown>;
};

export type RemoteMirrorSlices = {
  dossiers?: RemoteDossierMirrorRow[];
  live_states?: LiveStateMirrorRow[];
  settlements?: RemoteKeyedSliceRow[];
  learning_cases?: RemoteKeyedSliceRow[];
};

export type RemoteMirrorArtifact = {
  schema: typeof REMOTE_MIRROR_SCHEMA;
  published_at: string;
  payload: RuntimeIngestPayload;
  board_events: BoardEventMirrorRow[];
  /** Optional — older artifacts omit this. Board publish must not wipe existing rows. */
  dossiers?: RemoteDossierMirrorRow[];
  live_states?: LiveStateMirrorRow[];
  settlements?: RemoteKeyedSliceRow[];
  learning_cases?: RemoteKeyedSliceRow[];
  neon_in_use: false;
  backend: RemoteMirrorBackend;
};

export type RemoteMirrorStore = {
  readonly kind: RemoteMirrorBackend;
  read(): Promise<RemoteMirrorArtifact | null>;
  write(art: RemoteMirrorArtifact): Promise<void>;
};

export type RuntimeIngestAuth =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string; error_it: string };

export type RemotePushResult = {
  pushed: boolean;
  reason?: string;
  status?: number;
};

let storeOverride: RemoteMirrorStore | null = null;

export function setRemoteMirrorStoreOverride(store: RemoteMirrorStore | null): void {
  storeOverride = store;
}

export function createMemoryRemoteMirrorStore(): RemoteMirrorStore {
  let art: RemoteMirrorArtifact | null = null;
  return {
    kind: "memory",
    async read() {
      return art;
    },
    async write(next) {
      art = next;
    },
  };
}

export function blobCredentialsPresent(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  return Boolean(process.env.VERCEL_OIDC_TOKEN?.trim() && process.env.BLOB_STORE_ID?.trim());
}

export function remoteMirrorDurableConfigured(): boolean {
  if (storeOverride) return storeOverride.kind !== "none";
  return blobCredentialsPresent();
}

export function remotePublishClientConfigured(
  url = process.env.BETMIND_RUNTIME_INGEST_URL,
  secret = process.env.BETMIND_RUNTIME_PUBLISH_SECRET,
): boolean {
  return Boolean(url?.trim() && secret?.trim());
}

export function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function extractPublishSecret(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  return (req.headers.get("x-betmind-publish-secret") ?? "").trim();
}

export function authorizeRuntimeIngest(
  req: Request,
  expected = process.env.BETMIND_RUNTIME_PUBLISH_SECRET,
): RuntimeIngestAuth {
  const secret = expected?.trim() ?? "";
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "ingest_secret_missing",
      error_it:
        "Ingest non configurato (manca BETMIND_RUNTIME_PUBLISH_SECRET). Vercel resta OFFLINE.",
    };
  }
  const provided = extractPublishSecret(req);
  if (!provided || !secretsEqual(provided, secret)) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      error_it: "Segreto di pubblicazione assente o errato.",
    };
  }
  return { ok: true };
}

export function extractBoardEventsFromPayload(payload: RuntimeIngestPayload): BoardEventMirrorRow[] {
  const events = (payload.observatory?.next_events as unknown[] | undefined) ?? [];
  const publishedAt = payload.published_at;
  const out: BoardEventMirrorRow[] = [];
  const seen = new Set<string>();
  for (const raw of events) {
    const row = raw as Record<string, unknown>;
    const eventId = String(row.event_id ?? "");
    if (!eventId || seen.has(eventId)) continue;
    seen.add(eventId);
    out.push({
      event_id: eventId,
      bucket: String(row.bucket ?? "DISCOVERED"),
      published_at: publishedAt,
      payload: raw,
    });
  }
  return out;
}

export function isRealAnalysisDossier(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  const event = d.event;
  if (!event || typeof event !== "object") return false;
  const eventId = String((event as { event_id?: unknown }).event_id ?? "");
  if (!eventId) return false;
  const hasAnalysis =
    Array.isArray(d.features) ||
    Array.isArray(d.research) ||
    (d.lineage != null && typeof d.lineage === "object") ||
    (d.independent_model != null && typeof d.independent_model === "object");
  if (!hasAnalysis) return false;
  if ("bucket" in d && !d.independent_model && !Array.isArray(d.features)) return false;
  return true;
}

export function mergeDossierRows(
  existing: RemoteDossierMirrorRow[] | undefined,
  incoming: RemoteDossierMirrorRow[] | undefined,
): RemoteDossierMirrorRow[] {
  const by = new Map<string, RemoteDossierMirrorRow>();
  // Keep prior remote rows by event_id even if the heuristic is picky —
  // a board rewrite must not drop a dossier that was already mirrored.
  for (const row of existing ?? []) {
    if (!row?.event_id || !row.dossier || typeof row.dossier !== "object") continue;
    by.set(row.event_id, row);
  }
  for (const row of incoming ?? []) {
    if (!row?.event_id || !isRealAnalysisDossier(row.dossier)) continue;
    const prev = by.get(row.event_id);
    if (!prev || String(row.published_at ?? "") >= String(prev.published_at ?? "")) {
      by.set(row.event_id, row);
    }
  }
  return [...by.values()];
}

export function mergeByEventId<T extends { event_id: string; published_at?: string }>(
  existing: T[] | undefined,
  incoming: T[] | undefined,
): T[] {
  const by = new Map<string, T>();
  for (const row of existing ?? []) {
    if (!row?.event_id) continue;
    by.set(row.event_id, row);
  }
  for (const row of incoming ?? []) {
    if (!row?.event_id) continue;
    const prev = by.get(row.event_id);
    if (!prev || String(row.published_at ?? "") >= String(prev.published_at ?? "")) {
      by.set(row.event_id, row);
    }
  }
  return [...by.values()];
}

function mergePayloadArrayByEventId(existing: unknown, incoming: unknown): unknown[] {
  const asRows = (v: unknown): Array<Record<string, unknown>> =>
    Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object")) : [];
  const ex = asRows(existing);
  const inc = asRows(incoming);
  if (!inc.length) return ex;
  if (!ex.length) return inc;
  const by = new Map<string, Record<string, unknown>>();
  for (const row of ex) {
    const id = String(row.event_id ?? "");
    if (id) by.set(id, row);
  }
  for (const row of inc) {
    const id = String(row.event_id ?? "");
    if (!id) continue;
    const prev = by.get(id);
    if (!prev || String(row.published_at ?? row.settled_at ?? "") >= String(prev.published_at ?? prev.settled_at ?? "")) {
      by.set(id, row);
    }
  }
  return [...by.values()];
}

export function findDossierInRemoteMirror(
  remote: RemoteMirrorArtifact | null,
  eventId: string,
): Record<string, unknown> | null {
  if (!remote || !eventId) return null;
  for (const row of remote.dossiers ?? []) {
    if (String(row.event_id) === eventId && isRealAnalysisDossier(row.dossier)) {
      return row.dossier;
    }
  }
  return null;
}

export function liveRowsFromRemoteArtifact(
  remote: Pick<RemoteMirrorArtifact, "live_states" | "payload"> | null | undefined,
): LiveStateMirrorRow[] {
  const payload = (remote?.payload ?? {}) as RuntimeIngestPayload;
  const next = payload.observatory?.next_events;
  const fromBoard = Array.isArray(next)
    ? next.filter((row) => {
        if (!row || typeof row !== "object") return false;
        const rec = row as Record<string, unknown>;
        return /live|ht|ft|in_play|playing|first_half|second_half/i.test(String(rec.status ?? ""));
      })
    : [];
  return collectLiveRows(remote?.live_states, payload.live_states, payload.live_snapshots, fromBoard);
}

export function buildRemoteMirrorArtifact(
  payload: RuntimeIngestPayload,
  boardEvents?: BoardEventMirrorRow[],
  backend: RemoteMirrorBackend = "vercel_blob",
  dossiers?: RemoteDossierMirrorRow[],
  slices?: Omit<RemoteMirrorSlices, "dossiers">,
): RemoteMirrorArtifact {
  const live = Array.isArray(slices?.live_states) ? slices!.live_states : [];
  const observatory = payload.observatory;
  const next = overlayLiveOnEvents(
    (observatory?.next_events as unknown[] | undefined) ?? [],
    live,
  );
  const mergedPayload: RuntimeIngestPayload = {
    ...payload,
    observatory: observatory
      ? { ...observatory, next_events: next.length ? next : observatory.next_events }
      : observatory,
    // Lab PC already writes this field; keep it in lockstep with live_states.
    live_snapshots: live,
  };
  return {
    schema: REMOTE_MIRROR_SCHEMA,
    published_at: payload.published_at,
    payload: mergedPayload,
    board_events: boardEvents?.length ? boardEvents : extractBoardEventsFromPayload(mergedPayload),
    // Caller must pass mergeDossierRows(...) — never invent dossiers here.
    dossiers: Array.isArray(dossiers) ? dossiers : [],
    live_states: live,
    settlements: Array.isArray(slices?.settlements) ? slices!.settlements : [],
    learning_cases: Array.isArray(slices?.learning_cases) ? slices!.learning_cases : [],
    neon_in_use: false,
    backend,
  };
}

function isBlobNotFound(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /404|not.?found|blobnotfound|nosuchkey/i.test(msg);
}

function noneStore(): RemoteMirrorStore {
  return {
    kind: "none",
    async read() {
      return null;
    },
    async write() {
      throw new Error("remote_mirror_unconfigured");
    },
  };
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

function vercelBlobStore(): RemoteMirrorStore {
  return {
    kind: "vercel_blob",
    async read() {
      const { get } = await import("@vercel/blob");
      let result: { statusCode?: number; stream?: ReadableStream<Uint8Array> | null } | null;
      try {
        result = await get(REMOTE_MIRROR_PATHNAME, {
          access: "private",
          useCache: false,
        });
      } catch (e) {
        if (isBlobNotFound(e)) return null;
        throw e;
      }
      if (!result || result.statusCode === 404) return null;
      if (result.statusCode !== 200 || !result.stream) {
        throw new Error(`blob_get_${result.statusCode ?? "unknown"}`);
      }
      const text = await streamToText(result.stream);
      const parsed = JSON.parse(text) as RemoteMirrorArtifact;
      if (!parsed?.payload || !parsed.published_at) {
        throw new Error("blob_artifact_invalid");
      }
      return {
        ...parsed,
        neon_in_use: false,
        backend: "vercel_blob",
        board_events: Array.isArray(parsed.board_events) ? parsed.board_events : [],
        dossiers: Array.isArray(parsed.dossiers) ? parsed.dossiers : [],
        live_states: Array.isArray(parsed.live_states) ? parsed.live_states : [],
        settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
        learning_cases: Array.isArray(parsed.learning_cases) ? parsed.learning_cases : [],
      };
    },
    async write(art) {
      const { put } = await import("@vercel/blob");
      await put(REMOTE_MIRROR_PATHNAME, JSON.stringify(art), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
  };
}

export function getRemoteMirrorStore(): RemoteMirrorStore {
  if (storeOverride) return storeOverride;
  if (blobCredentialsPresent()) return vercelBlobStore();
  return noneStore();
}

export async function readRemoteMirror(): Promise<RemoteMirrorArtifact | null> {
  try {
    return await getRemoteMirrorStore().read();
  } catch {
    return null;
  }
}

export async function writeRemoteMirror(
  payload: RuntimeIngestPayload,
  boardEvents?: BoardEventMirrorRow[],
  dossiers?: RemoteDossierMirrorRow[],
  slices?: Omit<RemoteMirrorSlices, "dossiers">,
): Promise<
  | {
      ok: true;
      backend: RemoteMirrorBackend;
      dossiers: number;
      live_states: number;
      settlements: number;
      learning_cases: number;
    }
  | { ok: false; error: string }
> {
  const store = getRemoteMirrorStore();
  if (store.kind === "none") {
    return { ok: false, error: "blob_token_missing" };
  }
  let existing: RemoteMirrorArtifact | null = null;
  try {
    existing = await store.read();
  } catch (e) {
    // Fail closed: a board rewrite must not clobber dossiers we could not read.
    return {
      ok: false,
      error: `existing_mirror_unread:${e instanceof Error ? e.message : String(e)}`,
    };
  }
  try {
    const incoming = Array.isArray(dossiers) ? dossiers : [];
    const merged = mergeDossierRows(existing?.dossiers, incoming);
    if ((existing?.dossiers?.length ?? 0) > 0 && merged.length === 0) {
      return { ok: false, error: "dossier_merge_empty" };
    }
    const existingPayload = (existing?.payload ?? {}) as RuntimeIngestPayload;
    const incomingPayload = payload;
    const existingLive = collectLiveRows(
      existing?.live_states,
      existingPayload.live_states,
      existingPayload.live_snapshots,
    );
    const incomingLive = collectLiveRows(
      slices?.live_states,
      incomingPayload.live_states,
      incomingPayload.live_snapshots,
    );
    const mergedLive = mergeByEventId(existingLive, incomingLive);
    const mergedSettlements = mergeByEventId(existing?.settlements, slices?.settlements);
    const mergedLearning = mergeByEventId(existing?.learning_cases, slices?.learning_cases);
    if (existingLive.length > 0 && mergedLive.length === 0) {
      return { ok: false, error: "live_merge_empty" };
    }
    if ((existing?.settlements?.length ?? 0) > 0 && mergedSettlements.length === 0) {
      return { ok: false, error: "settlement_merge_empty" };
    }
    if ((existing?.learning_cases?.length ?? 0) > 0 && mergedLearning.length === 0) {
      return { ok: false, error: "learning_merge_empty" };
    }
    const mergedPayload: RuntimeIngestPayload = {
      ...payload,
      recent_settlements: mergePayloadArrayByEventId(
        existingPayload.recent_settlements,
        payload.recent_settlements,
      ),
      learning_cases: mergePayloadArrayByEventId(
        existingPayload.learning_cases,
        payload.learning_cases,
      ),
    };
    const art = buildRemoteMirrorArtifact(mergedPayload, boardEvents, store.kind, merged, {
      live_states: mergedLive,
      settlements: mergedSettlements,
      learning_cases: mergedLearning,
    });
    if (art.neon_in_use !== false || NEON_IN_USE) {
      return { ok: false, error: "neon_banned" };
    }
    await store.write(art);
    return {
      ok: true,
      backend: store.kind,
      dossiers: merged.length,
      live_states: mergedLive.length,
      settlements: mergedSettlements.length,
      learning_cases: mergedLearning.length,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function ingestRuntimeMirrorBody(body: unknown): {
  ok: boolean;
  status: number;
  payload?: RuntimeIngestPayload;
  board_events?: BoardEventMirrorRow[];
  dossiers?: RemoteDossierMirrorRow[];
  live_states?: LiveStateMirrorRow[];
  settlements?: RemoteKeyedSliceRow[];
  learning_cases?: RemoteKeyedSliceRow[];
  error?: string;
  error_it?: string;
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      error_it: "Corpo JSON assente o non valido.",
    };
  }
  const rec = body as {
    payload?: RuntimeIngestPayload;
    board_events?: BoardEventMirrorRow[];
    dossiers?: RemoteDossierMirrorRow[];
    live_states?: LiveStateMirrorRow[];
    settlements?: RemoteKeyedSliceRow[];
    learning_cases?: RemoteKeyedSliceRow[];
  };
  const payload = rec.payload;
  if (!payload || typeof payload !== "object" || !payload.published_at || !payload.components) {
    return {
      ok: false,
      status: 400,
      error: "invalid_payload",
      error_it: "Manca il payload runtime (published_at / components).",
    };
  }
  const board = Array.isArray(rec.board_events)
    ? rec.board_events
    : extractBoardEventsFromPayload(payload);
  const dossiers = Array.isArray(rec.dossiers)
    ? rec.dossiers.filter((row) => row?.event_id && isRealAnalysisDossier(row.dossier))
    : [];
  const live_states = collectLiveRows(
    rec.live_states,
    rec.payload && typeof rec.payload === "object"
      ? (rec.payload as RuntimeIngestPayload).live_snapshots
      : null,
    rec.payload && typeof rec.payload === "object"
      ? (rec.payload as RuntimeIngestPayload).live_states
      : null,
    (rec as { live_snapshots?: unknown }).live_snapshots,
  );
  const settlements = Array.isArray(rec.settlements)
    ? rec.settlements.filter((row) => row?.event_id && row.payload)
    : [];
  const learning_cases = Array.isArray(rec.learning_cases)
    ? rec.learning_cases.filter((row) => row?.event_id && row.payload)
    : [];
  return {
    ok: true,
    status: 200,
    payload,
    board_events: board,
    dossiers,
    live_states,
    settlements,
    learning_cases,
  };
}

export async function acceptRuntimeIngest(body: unknown): Promise<{
  ok: boolean;
  status: number;
  published_at?: string;
  board?: number;
  dossiers?: number;
  live_states?: number;
  settlements?: number;
  learning_cases?: number;
  backend?: RemoteMirrorBackend;
  neon_in_use: false;
  error?: string;
  error_it?: string;
}> {
  const parsed = ingestRuntimeMirrorBody(body);
  if (!parsed.ok || !parsed.payload) {
    return {
      ok: parsed.ok,
      status: parsed.status,
      neon_in_use: false,
      error: parsed.error,
      error_it: parsed.error_it,
    };
  }
  if (!remoteMirrorDurableConfigured()) {
    return {
      ok: false,
      status: 503,
      neon_in_use: false,
      error: "blob_token_missing",
      error_it:
        "Specchio remoto non configurato (manca BLOB_READ_WRITE_TOKEN). Modalità solo locale: Vercel resta OFFLINE.",
    };
  }
  const written = await writeRemoteMirror(parsed.payload, parsed.board_events, parsed.dossiers, {
    live_states: parsed.live_states,
    settlements: parsed.settlements,
    learning_cases: parsed.learning_cases,
  });
  if (!written.ok) {
    return {
      ok: false,
      status: 503,
      neon_in_use: false,
      error: written.error,
      error_it: "Scrittura specchio remoto fallita. Vercel non finge ONLINE.",
    };
  }
  return {
    ok: true,
    status: 200,
    published_at: parsed.payload.published_at,
    board: parsed.board_events?.length ?? 0,
    dossiers: written.dossiers,
    live_states: written.live_states,
    settlements: written.settlements,
    learning_cases: written.learning_cases,
    backend: written.backend,
    neon_in_use: false,
  };
}

export async function pushRuntimeToRemoteIngest(
  payload: RuntimeIngestPayload,
  boardEvents?: BoardEventMirrorRow[],
  deps?: {
    fetchImpl?: typeof fetch;
    url?: string;
    secret?: string;
    dossiers?: RemoteDossierMirrorRow[];
    live_states?: LiveStateMirrorRow[];
    settlements?: RemoteKeyedSliceRow[];
    learning_cases?: RemoteKeyedSliceRow[];
  },
): Promise<RemotePushResult> {
  const url = (deps?.url ?? process.env.BETMIND_RUNTIME_INGEST_URL)?.trim();
  const secret = (deps?.secret ?? process.env.BETMIND_RUNTIME_PUBLISH_SECRET)?.trim();
  if (!url || !secret) {
    return { pushed: false, reason: "local_only" };
  }
  const fetchImpl = deps?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        payload,
        board_events: boardEvents ?? extractBoardEventsFromPayload(payload),
        dossiers: deps?.dossiers ?? [],
        live_states: deps?.live_states ?? [],
        settlements: deps?.settlements ?? [],
        learning_cases: deps?.learning_cases ?? [],
      }),
    });
    if (!res.ok) {
      let detail = `http_${res.status}`;
      try {
        const json = (await res.json()) as { error?: string };
        if (json?.error) detail = json.error;
      } catch {
        /* keep status */
      }
      return { pushed: false, reason: detail, status: res.status };
    }
    return { pushed: true, status: res.status };
  } catch (e) {
    return { pushed: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export function remoteFreshness(
  publishedAt: string,
  nowMs = Date.now(),
  staleMs = 10 * 60 * 1000,
): { age_ms: number; fresh: boolean } {
  const age_ms = Math.max(0, nowMs - Date.parse(publishedAt));
  return {
    age_ms,
    fresh: Number.isFinite(age_ms) && age_ms <= staleMs,
  };
}

export function isRemoteMirrorSource(src: unknown): boolean {
  const s = String(src ?? "");
  return s === "remote" || s === "vercel_blob" || s === "memory" || s === "neon";
}

/** Unwrap a board row (mirror JSONL or observatory next_events) without inventing fields. */
export function unwrapBoardEventRow(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  let payload: Record<string, unknown>;
  if (typeof rec.payload === "string") {
    try {
      payload = JSON.parse(rec.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  } else if (rec.payload && typeof rec.payload === "object") {
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

/**
 * Same sources as the Eventi list: Blob `board_events`, then observatory next_events.
 * Does not invent a row when the id is absent from the remote mirror.
 */
export function findBoardEventInRemoteMirror(
  remote: RemoteMirrorArtifact | null,
  eventId: string,
): Record<string, unknown> | null {
  if (!remote || !eventId) return null;
  for (const row of remote.board_events ?? []) {
    const ev = unwrapBoardEventRow(row);
    if (ev && String(ev.event_id) === eventId) return ev;
  }
  const next = remote.payload?.observatory?.next_events;
  if (Array.isArray(next)) {
    for (const row of next) {
      const ev = unwrapBoardEventRow(row);
      if (ev && String(ev.event_id) === eventId) return ev;
    }
  }
  return null;
}

function asLightAnalysisRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  const rec = v as Record<string, unknown>;
  if (!String(rec.event_id ?? "") || !Array.isArray(rec.markets) || rec.mode !== "light") {
    return null;
  }
  return rec;
}

/**
 * Surface a light analysis already stored on the remote mirror. Never synthesizes one
 * from board lite fields.
 */
export function findLightAnalysisInRemoteMirror(
  remote: RemoteMirrorArtifact | null,
  eventId: string,
): Record<string, unknown> | null {
  if (!remote || !eventId) return null;
  const extra = remote as RemoteMirrorArtifact & { light_analyses?: unknown };
  const payload = remote.payload as RuntimeIngestPayload & { light_analyses?: unknown };
  const lists = [extra.light_analyses, payload.light_analyses];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const hit = asLightAnalysisRecord(row);
      if (hit && String(hit.event_id) === eventId) return hit;
    }
  }
  const board = findBoardEventInRemoteMirror(remote, eventId);
  return asLightAnalysisRecord(board?.light_analysis);
}

export function findLiveInRemoteMirror(
  remote: RemoteMirrorArtifact | null,
  eventId: string,
): LiveStateMirrorRow | null {
  if (!remote || !eventId) return null;
  return liveRowsFromRemoteArtifact(remote).find((row) => row.event_id === eventId) ?? null;
}

/** Latest of artifact published_at and any live snapshot — a live write keeps the mirror fresh. */
export function remoteMirrorActivityAt(remote: RemoteMirrorArtifact | null): string | null {
  if (!remote) return null;
  const liveAt = latestLiveTimestamp(liveRowsFromRemoteArtifact(remote));
  const published = remote.published_at || remote.payload?.published_at || null;
  if (!liveAt) return published;
  if (!published) return liveAt;
  return Date.parse(liveAt) >= Date.parse(published) ? liveAt : published;
}

export function findSettlementInRemoteMirror(
  remote: RemoteMirrorArtifact | null,
  eventId: string,
): Record<string, unknown> | null {
  if (!remote || !eventId) return null;
  for (const row of remote.settlements ?? []) {
    if (String(row.event_id) === eventId && row.payload && typeof row.payload === "object") {
      return row.payload;
    }
  }
  const list = remote.payload?.recent_settlements;
  if (Array.isArray(list)) {
    for (const raw of list) {
      if (raw && typeof raw === "object" && String((raw as { event_id?: unknown }).event_id) === eventId) {
        return raw as Record<string, unknown>;
      }
    }
  }
  return null;
}

export function findLearningInRemoteMirror(
  remote: RemoteMirrorArtifact | null,
  eventId: string,
): Record<string, unknown> | null {
  if (!remote || !eventId) return null;
  for (const row of remote.learning_cases ?? []) {
    if (String(row.event_id) === eventId && row.payload && typeof row.payload === "object") {
      return row.payload;
    }
  }
  const list = remote.payload?.learning_cases;
  if (Array.isArray(list)) {
    for (const raw of list) {
      if (raw && typeof raw === "object" && String((raw as { event_id?: unknown }).event_id) === eventId) {
        return raw as Record<string, unknown>;
      }
    }
  }
  return null;
}
