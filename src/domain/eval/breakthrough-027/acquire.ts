/**
 * Legitimate GET / local cache only. No credentials, no purchase, no WAF bypass.
 */

import { existsSync, mkdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  TASK027_CACHE_DIR,
  kaggleAustroExtractDir,
  kaggleAustroZipPath,
  strictCandidatesPath,
} from "@/domain/eval/breakthrough-027/config";
import type { HuntRow027 } from "@/domain/eval/breakthrough-027/types";

export type Acquire027 = {
  zip_present: boolean;
  zip_bytes: number | null;
  extract_present: boolean;
  series_gz: boolean;
  series_b_gz: boolean;
  matches_gz: boolean;
  candidates_present: boolean;
  candidates_bytes: number | null;
  extract_ran: boolean;
  extract_note: string;
};

export function inspectLocal027(): Acquire027 {
  const zip = kaggleAustroZipPath();
  const dir = kaggleAustroExtractDir();
  const cand = strictCandidatesPath();
  const series = join(dir, "odds_series.csv.gz");
  const seriesB = join(dir, "odds_series_b.csv.gz");
  const matches = join(dir, "odds_series_matches.csv.gz");
  return {
    zip_present: existsSync(zip),
    zip_bytes: existsSync(zip) ? statSync(zip).size : null,
    extract_present: existsSync(dir),
    series_gz: existsSync(series),
    series_b_gz: existsSync(seriesB),
    matches_gz: existsSync(matches),
    candidates_present: existsSync(cand),
    candidates_bytes: existsSync(cand) ? statSync(cand).size : null,
    extract_ran: false,
    extract_note: existsSync(cand)
      ? "strict-candidates.csv already on disk"
      : "strict-candidates.csv missing — run extract script",
  };
}

export function extractStrictIfNeeded(): Acquire027 {
  mkdirSync(TASK027_CACHE_DIR, { recursive: true });
  const before = inspectLocal027();
  if (before.candidates_present) return before;
  const script = join(process.cwd(), "src", "scripts", "extract-task-027.py");
  if (!existsSync(script)) {
    return { ...before, extract_note: "extract-task-027.py missing" };
  }
  const r = spawnSync("python", [script], { encoding: "utf8", timeout: 180_000 });
  const after = inspectLocal027();
  return {
    ...after,
    extract_ran: true,
    extract_note: (r.stdout || "") + (r.stderr || "") || `exit ${r.status}`,
  };
}

export function huntRowLocalAustro(acq: Acquire027): HuntRow027 | null {
  if (!acq.zip_present && !acq.candidates_present) return null;
  return {
    source: "local-cache-kaggle-austro",
    url: "file://audit/external/task-027/",
    what_found: `zip=${acq.zip_present} bytes=${acq.zip_bytes} candidates=${acq.candidates_present} bytes=${acq.candidates_bytes}`,
    downloadable: true,
    format: "zip+csv.gz+csv",
    timestamp: "PHP hourly bins",
    kickoff: "overlay soccer UTC",
    matchable: "MATCH_EXACT",
    event_count: acq.candidates_present ? null : 128252,
    strict_count: null,
    license_status: "local gitignored cache",
    class: "VALID",
  };
}
