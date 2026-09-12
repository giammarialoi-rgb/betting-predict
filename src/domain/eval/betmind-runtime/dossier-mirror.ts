/**
 * Persist → verify → remote-mirror → verify analysis_dossier.
 * Board publish must never invent a dossier. Local YES + remote NO → repairMirror.
 * NEON NON UTILIZZATO
 */
import { getStorage } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  analyzedBoardRowFromDossier,
  type AnalyzedDossierLike,
} from "@/domain/eval/betmind-runtime/analyzed-board";
import {
  blobCredentialsPresent,
  findDossierInRemoteMirror,
  getRemoteMirrorStore,
  isRealAnalysisDossier,
  readRemoteMirror,
  remoteMirrorDurableConfigured,
  writeRemoteMirror,
  type RemoteDossierMirrorRow,
  type RuntimeIngestPayload,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import {
  buildAnalysisDossier,
  compactDossierForMirror,
  type AnalysisDossier,
} from "@/domain/eval/betmind-runtime/dossier";

export type DossierValidation =
  | { ok: true; event_id: string; dossier_version: string | null }
  | { ok: false; reason: string; missing: string[] };

export type DossierMirrorHealth = {
  local_count: number;
  remote_count: number | null;
  remote_backend: "vercel_blob" | "memory" | "none";
  blob_credentials: "KEY_PRESENT" | "KEY_MISSING";
  local_yes_remote_no: string[];
  neon_in_use: false;
};

export type RepairMirrorResult = {
  event_id: string;
  repaired: boolean;
  local: boolean;
  remote: boolean;
  remote_readable: boolean;
  backend: "vercel_blob" | "memory" | "none";
  reason?: string;
};

export type PersistMirrorResult = {
  event_id: string;
  local_persisted: boolean;
  local_verified: boolean;
  remote_mirrored: boolean;
  remote_verified: boolean;
  repaired: boolean;
  backend: "vercel_blob" | "memory" | "none";
  dossier_version: string | null;
  reason?: string;
  missing?: string[];
};

function dossierVersionOf(d: AnalysisDossier | Record<string, unknown>): string | null {
  const rec = d as AnalysisDossier;
  return rec.cycle?.model_version ?? rec.prediction_id ?? rec.analyzed_at ?? null;
}

export function validateAnalysisDossier(d: unknown): DossierValidation {
  if (!isRealAnalysisDossier(d)) {
    return {
      ok: false,
      reason: "not_analysis_dossier",
      missing: ["analysis_dossier"],
    };
  }
  const dossier = d as AnalysisDossier;
  const missing: string[] = [];
  const eventId = String(dossier.event?.event_id ?? "");
  if (!eventId) missing.push("event.event_id");
  if (!dossier.event?.home) missing.push("event.home");
  if (!dossier.event?.away) missing.push("event.away");
  if (!dossier.event?.competition) missing.push("event.competition");
  if (dossier.real_money !== false) missing.push("real_money=false");
  if (dossier.independent_model && dossier.independent_model.probability != null) {
    const p = dossier.independent_model.probability;
    const mv = String(dossier.independent_model.model_version ?? "");
    if (!mv.includes("INDEPENDENT") || mv.includes("NO_INDEPENDENT")) {
      return {
        ok: false,
        reason: "naked_probability_without_independent_model",
        missing: ["independent_model.model_version"],
      };
    }
    for (const k of ["HOME", "DRAW", "AWAY"] as const) {
      if (typeof p[k] !== "number" || !Number.isFinite(p[k])) missing.push(`probability.${k}`);
    }
  }
  if (missing.length) {
    return { ok: false, reason: "dossier_incomplete", missing };
  }
  return { ok: true, event_id: eventId, dossier_version: dossierVersionOf(dossier) };
}

export function toRemoteDossierRow(
  dossier: AnalysisDossier,
  publishedAt = new Date().toISOString(),
): RemoteDossierMirrorRow | null {
  const compact = compactDossierForMirror(dossier);
  if (!isRealAnalysisDossier(compact)) return null;
  return {
    event_id: dossier.event.event_id,
    published_at: publishedAt,
    dossier: compact,
    dossier_version: dossierVersionOf(dossier),
  };
}

export function collectLocalDossiersForRemote(
  root = permanentRoot044(),
  eventIds?: string[],
): RemoteDossierMirrorRow[] {
  try {
    const store = getStorage(root);
    const rows: RemoteDossierMirrorRow[] = [];
    const listed = store.listDossiers();
    const allow = eventIds?.length ? new Set(eventIds) : null;
    for (const row of listed) {
      if (allow && !allow.has(row.event_id)) continue;
      if (!isRealAnalysisDossier(row.payload)) continue;
      rows.push({
        event_id: row.event_id,
        published_at: row.published_at || new Date().toISOString(),
        dossier: row.payload as Record<string, unknown>,
        dossier_version: dossierVersionOf(row.payload as AnalysisDossier),
      });
    }
    return rows;
  } catch {
    return [];
  }
}

export async function verifyRemoteDossierReadable(eventId: string): Promise<{
  ok: boolean;
  backend: "vercel_blob" | "memory" | "none";
  reason?: string;
}> {
  const store = getRemoteMirrorStore();
  if (store.kind === "none") {
    return { ok: false, backend: "none", reason: "blob_token_missing" };
  }
  try {
    const remote = await store.read();
    const hit = findDossierInRemoteMirror(remote, eventId);
    if (!hit) return { ok: false, backend: store.kind, reason: "remote_dossier_missing" };
    return { ok: true, backend: store.kind };
  } catch (e) {
    return {
      ok: false,
      backend: store.kind,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function dossierMirrorHealth(root = permanentRoot044()): Promise<DossierMirrorHealth> {
  const local = collectLocalDossiersForRemote(root);
  const store = getRemoteMirrorStore();
  let remoteCount: number | null = null;
  const remoteIds = new Set<string>();
  if (store.kind !== "none") {
    try {
      const art = await store.read();
      for (const row of art?.dossiers ?? []) {
        if (row.event_id && isRealAnalysisDossier(row.dossier)) remoteIds.add(row.event_id);
      }
      remoteCount = remoteIds.size;
    } catch {
      remoteCount = null;
    }
  }
  return {
    local_count: local.length,
    remote_count: remoteCount,
    remote_backend: store.kind,
    blob_credentials: blobCredentialsPresent() ? "KEY_PRESENT" : "KEY_MISSING",
    local_yes_remote_no: local
      .map((r) => r.event_id)
      .filter((id) => store.kind !== "none" && !remoteIds.has(id)),
    neon_in_use: false,
  };
}

function fallbackPayload(publishedAt: string): RuntimeIngestPayload {
  return {
    published_at: publishedAt,
    components: {
      supervisor: "UNKNOWN",
      worker: "UNKNOWN",
      brain: "UNKNOWN",
      predictive_engine: "UNKNOWN",
      data_pipeline: "ONLINE",
      settlement: "UNKNOWN",
      learning: "UNKNOWN",
    },
    store_present_local: true,
    host: "dossier-mirror",
  };
}

/**
 * If local dossier exists and remote does not, write it onto the remote artifact.
 * Does not invent a dossier. Does not bypass Blob-unconfigured (honest none).
 */
export async function repairMirror(
  eventId: string,
  root = permanentRoot044(),
): Promise<RepairMirrorResult> {
  const store = getRemoteMirrorStore();
  const localPayload = getStorage(root).loadDossier(eventId);
  const localOk = isRealAnalysisDossier(localPayload);
  if (!localOk) {
    return {
      event_id: eventId,
      repaired: false,
      local: false,
      remote: false,
      remote_readable: false,
      backend: store.kind,
      reason: "local_dossier_missing",
    };
  }
  if (store.kind === "none") {
    return {
      event_id: eventId,
      repaired: false,
      local: true,
      remote: false,
      remote_readable: false,
      backend: "none",
      reason: "blob_token_missing",
    };
  }

  let existing = null;
  try {
    existing = await store.read();
  } catch {
    existing = null;
  }
  const already = findDossierInRemoteMirror(existing, eventId);
  const publishedAt = new Date().toISOString();
  const incoming: RemoteDossierMirrorRow[] = already
    ? []
    : [
        {
          event_id: eventId,
          published_at: publishedAt,
          dossier: localPayload as Record<string, unknown>,
          dossier_version: dossierVersionOf(localPayload as AnalysisDossier),
        },
      ];
  const payload = existing?.payload ?? fallbackPayload(publishedAt);
  const boardRow = analyzedBoardRowFromDossier(localPayload as AnalyzedDossierLike, publishedAt);
  const existingBoard = (existing?.board_events ?? []).filter((r) => r.event_id !== eventId);
  const written = await writeRemoteMirror(
    { ...payload, published_at: publishedAt },
    [...existingBoard, boardRow],
    incoming,
  );
  if (!written.ok) {
    return {
      event_id: eventId,
      repaired: false,
      local: true,
      remote: Boolean(already),
      remote_readable: Boolean(already),
      backend: store.kind,
      reason: written.error,
    };
  }
  const verify = await verifyRemoteDossierReadable(eventId);
  return {
    event_id: eventId,
    repaired: verify.ok,
    local: true,
    remote: verify.ok,
    remote_readable: verify.ok,
    backend: store.kind,
    reason: verify.ok ? undefined : verify.reason,
  };
}

/**
 * Build (if Lab B event exists) → validate → persist local → verify local →
 * mirror remote → verify remote. Auto-repair when local YES remote NO.
 */
export async function persistAndMirrorDossier(
  eventId: string,
  root = permanentRoot044(),
  built?: AnalysisDossier | null,
): Promise<PersistMirrorResult> {
  const dossier = built ?? buildAnalysisDossier(eventId, root);
  if (!dossier) {
    return {
      event_id: eventId,
      local_persisted: false,
      local_verified: false,
      remote_mirrored: false,
      remote_verified: false,
      repaired: false,
      backend: getRemoteMirrorStore().kind,
      dossier_version: null,
      reason: "event_or_dossier_unavailable",
      missing: ["analysis_dossier"],
    };
  }
  const validation = validateAnalysisDossier(dossier);
  if (!validation.ok) {
    return {
      event_id: eventId,
      local_persisted: false,
      local_verified: false,
      remote_mirrored: false,
      remote_verified: false,
      repaired: false,
      backend: getRemoteMirrorStore().kind,
      dossier_version: null,
      reason: validation.reason,
      missing: validation.missing,
    };
  }

  const storage = getStorage(root);
  storage.upsertDossier(eventId, compactDossierForMirror(dossier));
  const localRead = storage.loadDossier(eventId);
  const localVerified = isRealAnalysisDossier(localRead);
  if (!localVerified) {
    return {
      event_id: eventId,
      local_persisted: true,
      local_verified: false,
      remote_mirrored: false,
      remote_verified: false,
      repaired: false,
      backend: getRemoteMirrorStore().kind,
      dossier_version: validation.dossier_version,
      reason: "local_verify_failed",
    };
  }

  const store = getRemoteMirrorStore();
  if (store.kind === "none" || !remoteMirrorDurableConfigured()) {
    return {
      event_id: eventId,
      local_persisted: true,
      local_verified: true,
      remote_mirrored: false,
      remote_verified: false,
      repaired: false,
      backend: "none",
      dossier_version: validation.dossier_version,
      reason: "blob_token_missing",
    };
  }

  const repair = await repairMirror(eventId, root);
  return {
    event_id: eventId,
    local_persisted: true,
    local_verified: true,
    remote_mirrored: repair.remote,
    remote_verified: repair.remote_readable,
    repaired: repair.repaired,
    backend: repair.backend,
    dossier_version: validation.dossier_version,
    reason: repair.reason,
  };
}

export async function loadDossierLocalOrRemote(
  eventId: string,
  root = permanentRoot044(),
): Promise<{
  dossier: AnalysisDossier | null;
  source: "local_disk" | "remote" | null;
  local: boolean;
  remote: boolean;
}> {
  const local = getStorage(root).loadDossier(eventId);
  if (isRealAnalysisDossier(local)) {
    const remoteHit = findDossierInRemoteMirror(await readRemoteMirror(), eventId);
    return {
      dossier: local as AnalysisDossier,
      source: "local_disk",
      local: true,
      remote: Boolean(remoteHit),
    };
  }
  const remote = findDossierInRemoteMirror(await readRemoteMirror(), eventId);
  if (remote) {
    return { dossier: remote as AnalysisDossier, source: "remote", local: false, remote: true };
  }
  return { dossier: null, source: null, local: false, remote: false };
}
