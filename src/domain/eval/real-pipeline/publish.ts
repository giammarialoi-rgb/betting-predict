/**
 * Publish one real analysis_dossier. Merge-safe. Never wipe remote dossiers.
 * Board row is metadata only — never synthesized into a dossier.
 */
import { getStorage, NEON_IN_USE } from "@/domain/storage";
import { persistAndMirrorDossier, validateAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier-mirror";
import { analyzedBoardRowFromDossier } from "@/domain/eval/betmind-runtime/analyzed-board";
import {
  compactDossierForMirror,
  type AnalysisDossier,
} from "@/domain/eval/betmind-runtime/dossier";
import {
  blobCredentialsPresent,
  getRemoteMirrorStore,
  isRealAnalysisDossier,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import type { SlicePublishStatus } from "@/domain/eval/real-pipeline/types";

export type PublishAnalysisResult = {
  status: SlicePublishStatus;
  local_verified: boolean;
  remote_verified: boolean;
  remote_board: "OK" | "DOSSIER_NOT_MIRRORED" | "BLOB_NOT_CONFIGURED" | "ERROR";
  reason: string | null;
  backend: "vercel_blob" | "memory" | "none";
  dossier_id: string | null;
};

export async function publishAnalysis(input: {
  eventId: string;
  dossier: AnalysisDossier | null;
  labBRoot: string;
  nowIso: string;
}): Promise<PublishAnalysisResult> {
  if (NEON_IN_USE) {
    throw new Error("NEON_BANNED");
  }
  if (!input.dossier || !validateAnalysisDossier(input.dossier).ok) {
    return {
      status: "DOSSIER_NOT_MIRRORED",
      local_verified: false,
      remote_verified: false,
      remote_board: "DOSSIER_NOT_MIRRORED",
      reason: "analysis_dossier missing or invalid — not synthesized from board_summary",
      backend: getRemoteMirrorStore().kind,
      dossier_id: null,
    };
  }

  const storage = getStorage(input.labBRoot);
  storage.upsertBoardEvent(analyzedBoardRowFromDossier(input.dossier, input.nowIso));

  const compact = compactDossierForMirror(input.dossier);
  if (!isRealAnalysisDossier(compact)) {
    return {
      status: "PUBLISH_ERROR",
      local_verified: false,
      remote_verified: false,
      remote_board: "ERROR",
      reason: "compact_dossier_failed_real_check",
      backend: getRemoteMirrorStore().kind,
      dossier_id: input.dossier.prediction_id,
    };
  }

  const mirror = await persistAndMirrorDossier(input.eventId, input.labBRoot, input.dossier);
  const blob = blobCredentialsPresent();
  const backend = mirror.backend;

  if (mirror.local_verified && mirror.remote_verified) {
    return {
      status: "REMOTE_OK",
      local_verified: true,
      remote_verified: true,
      remote_board: "OK",
      reason: null,
      backend,
      dossier_id: input.dossier.prediction_id ?? input.eventId,
    };
  }
  if (mirror.local_verified && (backend === "none" || !blob)) {
    return {
      status: "BLOB_NOT_CONFIGURED",
      local_verified: true,
      remote_verified: false,
      remote_board: "BLOB_NOT_CONFIGURED",
      reason: mirror.reason ?? "BLOB_READ_WRITE_TOKEN missing",
      backend: "none",
      dossier_id: input.dossier.prediction_id ?? input.eventId,
    };
  }
  if (mirror.local_verified && !mirror.remote_verified) {
    return {
      status: "DOSSIER_NOT_MIRRORED",
      local_verified: true,
      remote_verified: false,
      remote_board: "DOSSIER_NOT_MIRRORED",
      reason: mirror.reason ?? "remote readback failed",
      backend,
      dossier_id: input.dossier.prediction_id ?? input.eventId,
    };
  }
  return {
    status: "PUBLISH_ERROR",
    local_verified: mirror.local_verified,
    remote_verified: false,
    remote_board: "ERROR",
    reason: mirror.reason ?? "publish failed",
    backend,
    dossier_id: input.dossier.prediction_id,
  };
}
