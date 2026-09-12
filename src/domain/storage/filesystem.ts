/**
 * Filesystem StorageProvider — Lab B JSONL + derived mirror files.
 * Least-invasive host option already in the repo.
 * NEON NON UTILIZZATO
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { NEON_IN_USE, STORAGE_BACKEND, assertNeonBanned } from "@/domain/storage/neon-ban";
import type {
  BoardEventMirrorRow,
  LiveStateMirrorRow,
  RuntimeMirrorRecord,
  StorageProvider,
} from "@/domain/storage/types";

function readJsonlFile<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  const out: T[] = [];
  for (const line of readFileSync(file, "utf8").split(/\n/).filter(Boolean)) {
    try {
      out.push(JSON.parse(line.replace(/^\uFEFF/, "")) as T);
    } catch {
      /* skip corrupt line */
    }
  }
  return out;
}

function writeJsonFile(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonFile<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

function appendLine(file: string, rec: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(rec)}\n`, "utf8");
}

function rewriteLatestById<T extends { event_id: string }>(file: string, row: T): void {
  mkdirSync(dirname(file), { recursive: true });
  const existing = readJsonlFile<T>(file).filter((r) => r.event_id !== row.event_id);
  existing.push(row);
  writeFileSync(file, `${existing.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");
}

function safeEventId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

export class FilesystemStorageProvider implements StorageProvider {
  readonly backend = STORAGE_BACKEND;
  readonly neon_in_use = NEON_IN_USE;
  readonly root: string;

  constructor(root = permanentRoot044()) {
    assertNeonBanned("FilesystemStorageProvider");
    this.root = root;
    // Do not mkdir in the constructor — Vercel /var/task is read-only.
    // Write paths mkdir lazily; list/load treat missing dirs as empty.
  }

  private mirrorDir(): string {
    return join(this.root, "mirror");
  }

  private dossierDir(): string {
    return join(this.root, "mirror", "dossiers");
  }

  private abs(rel: string): string {
    return join(this.root, rel);
  }

  appendJsonl(rel: string, rec: unknown): void {
    appendLine(this.abs(rel), rec);
  }

  readJsonl<T>(rel: string): T[] {
    return readJsonlFile<T>(this.abs(rel));
  }

  writeJson(rel: string, value: unknown): void {
    writeJsonFile(this.abs(rel), value);
  }

  readJson<T>(rel: string): T | null {
    return readJsonFile<T>(this.abs(rel));
  }

  publishRuntime(payload: unknown, publishedAt: string): void {
    writeJsonFile(join(this.mirrorDir(), "runtime-status.json"), {
      id: "default",
      published_at: publishedAt,
      payload,
      neon_in_use: false,
      backend: "filesystem",
    });
  }

  loadRuntime(): RuntimeMirrorRecord | null {
    const row = readJsonFile<{ published_at?: string; payload?: unknown }>(
      join(this.mirrorDir(), "runtime-status.json"),
    );
    if (!row?.payload) return null;
    return {
      published_at: String(row.published_at ?? ""),
      payload: row.payload,
    };
  }

  upsertBoardEvent(row: BoardEventMirrorRow): void {
    const path = join(this.mirrorDir(), "board-events.jsonl");
    const existing = readJsonlFile<BoardEventMirrorRow>(path).filter((r) => r.event_id !== row.event_id);
    existing.push(row);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${existing.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");
  }

  loadBoardEvents(): BoardEventMirrorRow[] {
    const by = new Map<string, BoardEventMirrorRow>();
    for (const row of readJsonlFile<BoardEventMirrorRow>(join(this.mirrorDir(), "board-events.jsonl"))) {
      if (!row?.event_id) continue;
      by.set(row.event_id, row);
    }
    return [...by.values()];
  }

  appendAnalysisCycle(rec: unknown): void {
    appendLine(join(this.mirrorDir(), "analysis-cycles.jsonl"), rec);
  }

  upsertDossier(eventId: string, payload: unknown): void {
    writeJsonFile(join(this.dossierDir(), `${safeEventId(eventId)}.json`), {
      event_id: eventId,
      published_at: new Date().toISOString(),
      payload,
      neon_in_use: false,
    });
  }

  loadDossier(eventId: string): unknown | null {
    const row = readJsonFile<{ payload?: unknown }>(join(this.dossierDir(), `${safeEventId(eventId)}.json`));
    return row?.payload ?? null;
  }

  listDossiers(): Array<{ event_id: string; published_at: string; payload: unknown }> {
    const dir = this.dossierDir();
    if (!existsSync(dir)) return [];
    const out: Array<{ event_id: string; published_at: string; payload: unknown }> = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const row = readJsonFile<{ event_id?: string; published_at?: string; payload?: unknown }>(
        join(dir, name),
      );
      const eventId = String(row?.event_id ?? "");
      if (!eventId || row?.payload == null) continue;
      out.push({
        event_id: eventId,
        published_at: String(row.published_at ?? ""),
        payload: row.payload,
      });
    }
    return out;
  }

  upsertLightAnalysis(row: { event_id: string; analyzed_at?: string }): void {
    rewriteLatestById(join(this.root, "light-analyses.jsonl"), row);
  }

  loadLightAnalysis(eventId: string): unknown | null {
    const rows = this.loadAllLightAnalyses().filter(
      (r) => (r as { event_id?: string }).event_id === eventId,
    );
    if (!rows.length) return null;
    rows.sort((a, b) =>
      String((b as { analyzed_at?: string }).analyzed_at ?? "").localeCompare(
        String((a as { analyzed_at?: string }).analyzed_at ?? ""),
      ),
    );
    return rows[0] ?? null;
  }

  loadAllLightAnalyses(): unknown[] {
    const by = new Map<string, { event_id: string; analyzed_at?: string }>();
    for (const row of readJsonlFile<{ event_id: string; analyzed_at?: string }>(
      join(this.root, "light-analyses.jsonl"),
    )) {
      if (!row?.event_id) continue;
      const prev = by.get(row.event_id);
      if (!prev || String(row.analyzed_at ?? "") >= String(prev.analyzed_at ?? "")) {
        by.set(row.event_id, row);
      }
    }
    return [...by.values()];
  }

  upsertLightHistory(blob: unknown): void {
    writeJsonFile(join(this.mirrorDir(), "light-history.json"), blob);
  }

  loadLightHistory(): unknown | null {
    return readJsonFile(join(this.mirrorDir(), "light-history.json"));
  }

  upsertLiveState(row: LiveStateMirrorRow): void {
    rewriteLatestById(join(this.mirrorDir(), "live-states.jsonl"), row);
  }

  loadLiveState(eventId: string): LiveStateMirrorRow | null {
    return this.listLiveStates().find((r) => r.event_id === eventId) ?? null;
  }

  listLiveStates(): LiveStateMirrorRow[] {
    const by = new Map<string, LiveStateMirrorRow>();
    for (const row of readJsonlFile<LiveStateMirrorRow>(join(this.mirrorDir(), "live-states.jsonl"))) {
      if (!row?.event_id) continue;
      const prev = by.get(row.event_id);
      if (!prev || String(row.published_at ?? "") >= String(prev.published_at ?? "")) {
        by.set(row.event_id, row);
      }
    }
    return [...by.values()];
  }
}

const cache = new Map<string, FilesystemStorageProvider>();

export function getFilesystemStorage(root = permanentRoot044()): FilesystemStorageProvider {
  const hit = cache.get(root);
  if (hit) return hit;
  const created = new FilesystemStorageProvider(root);
  cache.set(root, created);
  return created;
}
