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
import type { BoardEventMirrorRow } from "@/domain/storage/types";
import { NEON_IN_USE } from "@/domain/storage/neon-ban";

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

export type RemoteMirrorArtifact = {
  schema: typeof REMOTE_MIRROR_SCHEMA;
  published_at: string;
  payload: RuntimeIngestPayload;
  board_events: BoardEventMirrorRow[];
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

export function buildRemoteMirrorArtifact(
  payload: RuntimeIngestPayload,
  boardEvents?: BoardEventMirrorRow[],
  backend: RemoteMirrorBackend = "vercel_blob",
): RemoteMirrorArtifact {
  return {
    schema: REMOTE_MIRROR_SCHEMA,
    published_at: payload.published_at,
    payload,
    board_events: boardEvents?.length ? boardEvents : extractBoardEventsFromPayload(payload),
    neon_in_use: false,
    backend,
  };
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
      const result = await get(REMOTE_MIRROR_PATHNAME, {
        access: "private",
        useCache: false,
      });
      if (result?.statusCode !== 200 || !result.stream) return null;
      const text = await streamToText(result.stream);
      const parsed = JSON.parse(text) as RemoteMirrorArtifact;
      if (!parsed?.payload || !parsed.published_at) return null;
      return {
        ...parsed,
        neon_in_use: false,
        backend: "vercel_blob",
        board_events: Array.isArray(parsed.board_events) ? parsed.board_events : [],
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
): Promise<{ ok: true; backend: RemoteMirrorBackend } | { ok: false; error: string }> {
  const store = getRemoteMirrorStore();
  if (store.kind === "none") {
    return { ok: false, error: "blob_token_missing" };
  }
  try {
    const art = buildRemoteMirrorArtifact(payload, boardEvents, store.kind);
    if (art.neon_in_use !== false || NEON_IN_USE) {
      return { ok: false, error: "neon_banned" };
    }
    await store.write(art);
    return { ok: true, backend: store.kind };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function ingestRuntimeMirrorBody(body: unknown): {
  ok: boolean;
  status: number;
  payload?: RuntimeIngestPayload;
  board_events?: BoardEventMirrorRow[];
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
  const rec = body as { payload?: RuntimeIngestPayload; board_events?: BoardEventMirrorRow[] };
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
  return { ok: true, status: 200, payload, board_events: board };
}

export async function acceptRuntimeIngest(body: unknown): Promise<{
  ok: boolean;
  status: number;
  published_at?: string;
  board?: number;
  backend?: RemoteMirrorBackend;
  neon_in_use: false;
  error?: string;
  error_it?: string;
}> {
  const parsed = ingestRuntimeMirrorBody(body);
  if (!parsed.ok || !parsed.payload) {
    return { ...parsed, neon_in_use: false };
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
  const written = await writeRemoteMirror(parsed.payload, parsed.board_events);
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
    backend: written.backend,
    neon_in_use: false,
  };
}

export async function pushRuntimeToRemoteIngest(
  payload: RuntimeIngestPayload,
  boardEvents?: BoardEventMirrorRow[],
  deps?: { fetchImpl?: typeof fetch; url?: string; secret?: string },
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
