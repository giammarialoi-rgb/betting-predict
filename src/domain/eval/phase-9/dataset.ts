/**
 * Temporal OOS dataset — FEATURES(T) only from info before kickoff of T.
 * Uses existing PI FDouk import (HTTP). Does not rewrite Phase 8 adapters.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PI_DATASET_VERSION,
  PI_DIVISIONS,
  PI_SEASONS,
  piDatasetsRoot,
  sha256Hex,
} from "@/domain/eval/predictive-intelligence/config";
import { importFootballDataDataset, loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { featureCutoffForMatch, priorMatchesAsOf } from "@/domain/eval/predictive-intelligence/features/asof";
import { parseCsv, parseFootballDataCoUkDate } from "@/providers/football-data-co-uk/parser";
import { resolveFootballDataCoUkTeamId } from "@/providers/football-data-co-uk/team-aliases";
import { PHASE9_ARTIFACTS_DIR, PHASE9_DATASET_VERSION, phase9LabRoot } from "@/domain/eval/phase-9/config";
import type { Phase9Match } from "@/domain/eval/phase-9/types";
import { NEON_IN_USE } from "@/domain/storage";

export type Phase9DatasetManifest = {
  dataset_version: string;
  pi_dataset_version: string;
  created_at: string;
  neon_in_use: false;
  source: "football-data-co-uk";
  fetch_path: "predictive-intelligence/dataset/download";
  divisions: readonly string[];
  seasons: readonly string[];
  total_rows: number;
  unique_canonical_ids: number;
  date_min: string | null;
  date_max: string | null;
  leagues: Record<string, number>;
  seasons_counts: Record<string, number>;
  fields_coverage: Record<string, { n: number; share: number }>;
  odds_open_complete: number;
  odds_close_research_only: number;
  ou25_overlay_n: number;
  temporal_policy: {
    feature_cutoff: "match_dateT00:00:00.000Z";
    previous_match: "result_available_at < feature_cutoff AND event_time < target.event_time";
    date_only: true;
    timestamps_when_available: true;
  };
  missing_local_csv: true | false;
  downloads_ok: number;
  downloads_fail: number;
  notes: string[];
};

function num(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

function pickOu(row: Record<string, string>): { over: number | null; under: number | null } {
  const over =
    num(row["B365>2.5"]) ??
    num(row["Avg>2.5"]) ??
    num(row["P>2.5"]) ??
    num(row["BbAv>2.5"]) ??
    num(row["Max>2.5"]);
  const under =
    num(row["B365<2.5"]) ??
    num(row["Avg<2.5"]) ??
    num(row["P<2.5"]) ??
    num(row["BbAv<2.5"]) ??
    num(row["Max<2.5"]);
  return { over, under };
}

/** Overlay O/U 2.5 prices from raw FDouk CSV without changing Phase 8 PiMatchRow. */
export function overlayOu25FromRawCsv(input: {
  csvText: string;
  season: string;
  league: string;
}): Map<string, { over: number | null; under: number | null }> {
  const table = parseCsv(input.csvText);
  const map = new Map<string, { over: number | null; under: number | null }>();
  for (const row of table.rows) {
    const matchDate = parseFootballDataCoUkDate(row.Date ?? "", input.season);
    if (!matchDate) continue;
    const homeRaw = (row.HomeTeam ?? "").trim();
    const awayRaw = (row.AwayTeam ?? "").trim();
    if (!homeRaw || !awayRaw) continue;
    const homeId = resolveFootballDataCoUkTeamId(homeRaw) ?? `raw:${homeRaw.toLowerCase()}`;
    const awayId = resolveFootballDataCoUkTeamId(awayRaw) ?? `raw:${awayRaw.toLowerCase()}`;
    const day = matchDate.toISOString().slice(0, 10);
    const id = sha256Hex(`fdcuk|${input.league}|${input.season}|${day}|${homeId}|${awayId}`).slice(0, 32);
    const ou = pickOu(row);
    if (ou.over != null || ou.under != null) map.set(id, ou);
  }
  return map;
}

export function applyOu25Overlay(matches: Phase9Match[], labBRoot?: string): number {
  const rawDir = join(piDatasetsRoot(labBRoot), "raw");
  if (!existsSync(rawDir)) return 0;
  let n = 0;
  const byId = new Map(matches.map((m) => [m.canonical_id, m]));
  for (const season of PI_SEASONS) {
    for (const league of PI_DIVISIONS) {
      const p = join(rawDir, `${league}-${season}.csv`);
      if (!existsSync(p)) continue;
      const overlay = overlayOu25FromRawCsv({
        csvText: readFileSync(p, "utf8"),
        season,
        league,
      });
      for (const [id, ou] of overlay) {
        const m = byId.get(id);
        if (!m) continue;
        m.odds_ou25 = ou;
        n += 1;
      }
    }
  }
  return n;
}

function coverage(matches: Phase9Match[], pick: (m: Phase9Match) => boolean): { n: number; share: number } {
  const n = matches.filter(pick).length;
  return { n, share: matches.length ? n / matches.length : 0 };
}

export function summarizeMatches(matches: Phase9Match[]): Omit<
  Phase9DatasetManifest,
  | "created_at"
  | "downloads_ok"
  | "downloads_fail"
  | "missing_local_csv"
  | "notes"
  | "fetch_path"
  | "source"
  | "pi_dataset_version"
  | "dataset_version"
  | "neon_in_use"
  | "divisions"
  | "seasons"
  | "temporal_policy"
> {
  const leagues: Record<string, number> = {};
  const seasons_counts: Record<string, number> = {};
  const dates = matches.map((m) => m.match_date).sort();
  for (const m of matches) {
    leagues[m.league] = (leagues[m.league] ?? 0) + 1;
    seasons_counts[m.season] = (seasons_counts[m.season] ?? 0) + 1;
  }
  return {
    total_rows: matches.length,
    unique_canonical_ids: new Set(matches.map((m) => m.canonical_id)).size,
    date_min: dates[0] ?? null,
    date_max: dates[dates.length - 1] ?? null,
    leagues,
    seasons_counts,
    fields_coverage: {
      fthg_ftag: coverage(matches, (m) => m.fthg != null && m.ftag != null),
      hs_as: coverage(matches, (m) => m.hs != null && m.as != null),
      hc_ac: coverage(matches, (m) => m.hc != null && m.ac != null),
      hy_ay: coverage(matches, (m) => m.hy != null && m.ay != null),
      time: coverage(matches, (m) => !m.event_time.endsWith("T12:00:00.000Z")),
      odds_open_b365: coverage(
        matches,
        (m) => m.odds_open.B365.home != null && m.odds_open.B365.draw != null && m.odds_open.B365.away != null,
      ),
      odds_open_any: coverage(matches, (m) => {
        const t = m.odds_open.B365.home != null ? m.odds_open.B365 : m.odds_open.PS.home != null ? m.odds_open.PS : m.odds_open.Avg;
        return t.home != null && t.draw != null && t.away != null;
      }),
      ou25_overlay: coverage(matches, (m) => m.odds_ou25?.over != null && m.odds_ou25.under != null),
    },
    odds_open_complete: matches.filter((m) => {
      const t = m.odds_open.B365.home != null ? m.odds_open.B365 : m.odds_open.PS.home != null ? m.odds_open.PS : m.odds_open.Avg;
      return t.home != null && t.draw != null && t.away != null;
    }).length,
    odds_close_research_only: matches.filter(
      (m) => m.research_odds_close.B365C.home != null || m.research_odds_close.PSC.home != null,
    ).length,
    ou25_overlay_n: matches.filter((m) => m.odds_ou25?.over != null).length,
  };
}

export function loadPhase9Matches(labBRoot?: string): Phase9Match[] {
  return loadPiMatches(labBRoot) as Phase9Match[];
}

export async function buildPhase9Dataset(input?: {
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  forceDownload?: boolean;
  nowIso?: string;
  skipFetch?: boolean;
}): Promise<{ matches: Phase9Match[]; manifest: Phase9DatasetManifest }> {
  if (NEON_IN_USE) throw new Error("NEON_BANNED");
  const labB = phase9LabRoot(input?.labBRoot);
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const notes: string[] = [];
  let downloads_ok = 0;
  let downloads_fail = 0;

  let imported: Awaited<ReturnType<typeof importFootballDataDataset>> | null = null;
  if (!input?.skipFetch) {
    imported = await importFootballDataDataset({
      labBRoot: labB,
      fetchImpl: input?.fetchImpl,
      forceDownload: input?.forceDownload,
      nowIso,
    });
    downloads_ok = imported.downloads.filter((d) => d.ok).length;
    downloads_fail = imported.downloads.filter((d) => !d.ok).length;
    notes.push(`PI import rows=${imported.total_rows} downloads_ok=${downloads_ok}`);
  }

  const matches = loadPhase9Matches(labB);
  const ouN = applyOu25Overlay(matches, labB);
  notes.push(`OU2.5 overlay attached on ${ouN} rows (optional; not a feature)`);
  notes.push("Closing odds retained for research/CLV only — excluded from FEATURES(T)");

  const rawDir = join(piDatasetsRoot(labB), "raw");
  const missing_local_csv = !existsSync(rawDir) || downloads_ok === 0 && matches.length === 0;

  const summary = summarizeMatches(matches);
  const manifest: Phase9DatasetManifest = {
    dataset_version: PHASE9_DATASET_VERSION,
    pi_dataset_version: PI_DATASET_VERSION,
    created_at: nowIso,
    neon_in_use: false,
    source: "football-data-co-uk",
    fetch_path: "predictive-intelligence/dataset/download",
    divisions: PI_DIVISIONS,
    seasons: PI_SEASONS,
    ...summary,
    temporal_policy: {
      feature_cutoff: "match_dateT00:00:00.000Z",
      previous_match: "result_available_at < feature_cutoff AND event_time < target.event_time",
      date_only: true,
      timestamps_when_available: true,
    },
    missing_local_csv,
    downloads_ok,
    downloads_fail,
    notes,
  };

  mkdirSync(PHASE9_ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(PHASE9_ARTIFACTS_DIR, "dataset-manifest.json"), JSON.stringify(manifest, null, 2));
  return { matches, manifest };
}

export function assertDatasetTemporalOrder(matches: readonly Phase9Match[]): void {
  for (const m of matches) {
    const cut = featureCutoffForMatch(m);
    const priors = priorMatchesAsOf(matches, cut);
    if (priors.some((p) => p.canonical_id === m.canonical_id)) {
      throw new Error(`TARGET_LEAKAGE: ${m.canonical_id} in its own priors`);
    }
    for (const p of priors) {
      if (!(Date.parse(p.result_available_at) < Date.parse(cut))) {
        throw new Error(`TEMPORAL_LEAKAGE: ${p.canonical_id} vs ${m.canonical_id}`);
      }
    }
  }
}
