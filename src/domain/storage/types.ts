/**
 * StorageProvider — source/research/model/prediction/settlement/learning
 * talk to this interface, not to Neon or a concrete file layout.
 * Implementation: filesystem JSONL (Lab B + data/).
 * NEON NON UTILIZZATO
 */

export type StorageBackend = "filesystem";

export type RuntimeMirrorRecord = {
  published_at: string;
  payload: unknown;
};

export type BoardEventMirrorRow = {
  event_id: string;
  bucket: string;
  published_at: string;
  payload: unknown;
};

export type StorageProvider = {
  readonly backend: StorageBackend;
  readonly neon_in_use: false;
  readonly root: string;

  appendJsonl(rel: string, rec: unknown): void;
  readJsonl<T>(rel: string): T[];
  writeJson(rel: string, value: unknown): void;
  readJson<T>(rel: string): T | null;

  publishRuntime(payload: unknown, publishedAt: string): void;
  loadRuntime(): RuntimeMirrorRecord | null;
  upsertBoardEvent(row: BoardEventMirrorRow): void;
  loadBoardEvents(): BoardEventMirrorRow[];
  appendAnalysisCycle(rec: unknown): void;

  upsertDossier(eventId: string, payload: unknown): void;
  loadDossier(eventId: string): unknown | null;

  upsertLightAnalysis(row: { event_id: string; analyzed_at?: string }): void;
  loadLightAnalysis(eventId: string): unknown | null;
  loadAllLightAnalyses(): unknown[];

  upsertLightHistory(blob: unknown): void;
  loadLightHistory(): unknown | null;
};
