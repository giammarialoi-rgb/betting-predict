/**
 * Storage entrypoint. Always filesystem. NEON NON UTILIZZATO.
 */
import { getFilesystemStorage } from "@/domain/storage/filesystem";
import { NEON_IN_USE, NEON_STATUS_IT, STORAGE_BACKEND, neonIgnoredReason } from "@/domain/storage/neon-ban";
import type { StorageProvider } from "@/domain/storage/types";

export type { StorageProvider, BoardEventMirrorRow, RuntimeMirrorRecord } from "@/domain/storage/types";
export { FilesystemStorageProvider, getFilesystemStorage } from "@/domain/storage/filesystem";
export { NEON_IN_USE, NEON_STATUS_IT, STORAGE_BACKEND, neonIgnoredReason, neonUrlPresent, assertNeonBanned } from "@/domain/storage/neon-ban";

export function getStorage(root?: string): StorageProvider {
  return getFilesystemStorage(root);
}

export function storageBanner(): {
  backend: typeof STORAGE_BACKEND;
  neon_in_use: typeof NEON_IN_USE;
  neon_status_it: typeof NEON_STATUS_IT;
  note: string;
} {
  return {
    backend: STORAGE_BACKEND,
    neon_in_use: NEON_IN_USE,
    neon_status_it: NEON_STATUS_IT,
    note: neonIgnoredReason(),
  };
}
