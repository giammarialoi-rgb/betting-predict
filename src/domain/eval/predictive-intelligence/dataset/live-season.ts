/**
 * Current-season Football-Data.co.uk overlay (not frozen PI_SEASONS).
 * Odds columns are parsed by the normalizer but NEVER enter the independent model.
 * DATE_ONLY: rows without FT goals are rejected (upcoming fixtures are not results).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PI_DIVISIONS, piDatasetsRoot } from "@/domain/eval/predictive-intelligence/config";
import { downloadFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/download";
import { normalizeFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/normalize";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

/** 2025-26 and 2026-27 live windows. Tried in order; missing files stay missing. */
export const LIVE_FD_SEASONS = ["2627", "2526"] as const;

export type LiveSeasonImport = {
  season: string;
  league: string;
  ok: boolean;
  added: number;
  http_status: number | null;
  reason: string | null;
};

export async function importLiveFootballDataSeason(input?: {
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  forceDownload?: boolean;
}): Promise<{ added: number; downloads: LiveSeasonImport[]; matches_path: string }> {
  const root = piDatasetsRoot(input?.labBRoot);
  mkdirSync(root, { recursive: true });
  const livePath = join(root, "matches-live.jsonl");
  const existing = new Map<string, PiMatchRow>();
  for (const m of loadPiMatches(input?.labBRoot)) existing.set(m.canonical_id, m);
  if (existsSync(livePath)) {
    for (const line of readFileSync(livePath, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const m = JSON.parse(line) as PiMatchRow;
        existing.set(m.canonical_id, m);
      } catch {
        /* skip */
      }
    }
  }

  const downloads: LiveSeasonImport[] = [];
  const newly: PiMatchRow[] = [];
  for (const season of LIVE_FD_SEASONS) {
    for (const league of PI_DIVISIONS) {
      const d = await downloadFootballDataCsv({
        league,
        season,
        labBRoot: input?.labBRoot,
        fetchImpl: input?.fetchImpl,
        force: input?.forceDownload,
      });
      if (!d.ok || !d.rawPath || !existsSync(d.rawPath)) {
        downloads.push({
          season,
          league,
          ok: false,
          added: 0,
          http_status: d.attempts.at(-1)?.status ?? null,
          reason: d.attempts.at(-1)?.error ?? "DOWNLOAD_FAILED",
        });
        continue;
      }
      const csvText = readFileSync(d.rawPath, "utf8");
      const { matches } = normalizeFootballDataCsv({ csvText, season, league });
      let added = 0;
      for (const m of matches) {
        if (existing.has(m.canonical_id)) continue;
        existing.set(m.canonical_id, m);
        newly.push(m);
        added += 1;
      }
      downloads.push({
        season,
        league,
        ok: true,
        added,
        http_status: d.attempts.at(-1)?.status ?? 200,
        reason: null,
      });
    }
  }

  if (newly.length) {
    const prev = existsSync(livePath) ? readFileSync(livePath, "utf8") : "";
    writeFileSync(
      livePath,
      prev + newly.map((m) => JSON.stringify(m)).join("\n") + (newly.length ? "\n" : ""),
      "utf8",
    );
  }
  return { added: newly.length, downloads, matches_path: livePath };
}

/** Overlay is merged inside loadPiMatches when matches-live.jsonl exists. */
export function loadPiMatchesWithLive(labBRoot?: string): PiMatchRow[] {
  return loadPiMatches(labBRoot);
}
