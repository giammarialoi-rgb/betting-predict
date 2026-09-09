import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  PI_DATASET_VERSION,
  PI_DIVISIONS,
  PI_SEASONS,
  piDatasetsRoot,
  piRoot,
  sha256Hex,
} from "@/domain/eval/predictive-intelligence/config";
import { downloadAllPiDatasets, type PiDownloadResult } from "@/domain/eval/predictive-intelligence/dataset/download";
import { normalizeFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/normalize";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

export type PiDatasetManifest = {
  dataset_version: string;
  created_at: string;
  source: "football-data-co-uk";
  divisions: readonly string[];
  seasons: readonly string[];
  downloads: PiDownloadResult[];
  total_rows: number;
  unique_canonical_ids: number;
  matches_path: string;
  content_sha256: string;
  resumable: true;
  idempotent: true;
  deduplicated: true;
};

function matchesPath(labBRoot?: string): string {
  return join(piDatasetsRoot(labBRoot), "matches.jsonl");
}

function manifestPath(labBRoot?: string): string {
  return join(piRoot(labBRoot), "dataset-manifest.json");
}

export function loadPiMatches(labBRoot?: string): PiMatchRow[] {
  const p = matchesPath(labBRoot);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l.replace(/^\uFEFF/, "")) as PiMatchRow);
}

/** Idempotent import: skip already-present canonical_ids; resumable across seasons. */
export async function importFootballDataDataset(input?: {
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  forceDownload?: boolean;
  nowIso?: string;
}): Promise<PiDatasetManifest> {
  const root = piDatasetsRoot(input?.labBRoot);
  mkdirSync(root, { recursive: true });
  const nowIso = input?.nowIso ?? new Date().toISOString();

  const downloads = await downloadAllPiDatasets({
    labBRoot: input?.labBRoot,
    fetchImpl: input?.fetchImpl,
    force: input?.forceDownload,
  });

  const existing = new Map<string, PiMatchRow>();
  for (const m of loadPiMatches(input?.labBRoot)) {
    existing.set(m.canonical_id, m);
  }

  let added = 0;
  for (const d of downloads) {
    if (!d.ok || !d.rawPath || !existsSync(d.rawPath)) continue;
    const csvText = readFileSync(d.rawPath, "utf8");
    const { matches } = normalizeFootballDataCsv({
      csvText,
      season: d.season,
      league: d.league,
    });
    for (const m of matches) {
      if (existing.has(m.canonical_id)) continue;
      existing.set(m.canonical_id, m);
      added += 1;
    }
  }

  const sorted = [...existing.values()].sort((a, b) =>
    a.event_time < b.event_time ? -1 : a.event_time > b.event_time ? 1 : a.canonical_id.localeCompare(b.canonical_id),
  );

  const mp = matchesPath(input?.labBRoot);
  const body = sorted.map((m) => JSON.stringify(m)).join("\n") + (sorted.length ? "\n" : "");
  writeFileSync(mp, body, "utf8");

  const manifest: PiDatasetManifest = {
    dataset_version: PI_DATASET_VERSION,
    created_at: nowIso,
    source: "football-data-co-uk",
    divisions: PI_DIVISIONS,
    seasons: PI_SEASONS,
    downloads,
    total_rows: sorted.length,
    unique_canonical_ids: sorted.length,
    matches_path: mp,
    content_sha256: sha256Hex(body),
    resumable: true,
    idempotent: true,
    deduplicated: true,
  };

  writeFileSync(manifestPath(input?.labBRoot), JSON.stringify(manifest, null, 2));
  appendFileSync(
    join(piDatasetsRoot(input?.labBRoot), "import-journal.jsonl"),
    JSON.stringify({ at: nowIso, added, total: sorted.length, downloads_ok: downloads.filter((x) => x.ok).length }) +
      "\n",
  );

  return manifest;
}

export function loadPiDatasetManifest(labBRoot?: string): PiDatasetManifest | null {
  const p = manifestPath(labBRoot);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as PiDatasetManifest;
}
