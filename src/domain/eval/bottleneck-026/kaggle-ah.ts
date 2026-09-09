/**
 * Inspect Kaggle AH time-series zip. Public download is a SAMPLE (not the claimed 7,494).
 * License UNKNOWN / titan007 — not capital. FT/HT in the same file must not enter DecisionContext.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { classifyClock } from "@/domain/eval/bottleneck-026/classify";
import { kaggleAhZipPath } from "@/domain/eval/bottleneck-026/acquire";
import { TASK026_CACHE_DIR } from "@/domain/eval/bottleneck-026/config";

export function kaggleAhMiniPath(): string {
  return join(process.cwd(), "src", "domain", "eval", "bottleneck-026", "fixtures", "kaggle-ah-mini.csv");
}

export type KaggleAhFile026 = {
  path: string;
  league: string | null;
  match_id: string | null;
  rows: number;
  exact_timestamps: number;
  bookmakers: string[];
  ts_min: string | null;
  ts_max: string | null;
  has_ft_score: boolean;
  teams_look_cjk: boolean;
  kickoff_in_file: false;
};

export type KaggleAhInspect026 = {
  zip_present: boolean;
  zip_bytes: number | null;
  claimed_matches: 7494;
  public_csv_files: number;
  exact_timestamp_events: number;
  quote_rows: number;
  license: "UNKNOWN";
  provenance: "titan007.com (README)";
  kickoff_column: false;
  ft_in_odds_file: true;
  claimed_roi_used: false;
  files: KaggleAhFile026[];
  note: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function inspectAhCsv(text: string, relPath: string): KaggleAhFile026 {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0] ? parseCsvLine(lines[0]).map((h) => h.trim()) : [];
  const iTs = header.findIndex((h) => /^timestamp$/i.test(h));
  const iFt = header.findIndex((h) => /ft score/i.test(h));
  const iBk = header.findIndex((h) => /^bookmaker$/i.test(h));
  const iTeams = header.findIndex((h) => /^teams$/i.test(h));
  const books = new Set<string>();
  let exact = 0;
  let tsMin: string | null = null;
  let tsMax: string | null = null;
  let cjk = false;
  let hasFt = false;
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const ts = iTs >= 0 ? cols[iTs] ?? "" : "";
    const clock = classifyClock({ raw: ts, origin: "SOURCE_TIMESTAMP" });
    if (clock.precision === "EXACT_TIMESTAMP" && clock.iso) {
      exact += 1;
      if (tsMin == null || clock.iso < tsMin) tsMin = clock.iso;
      if (tsMax == null || clock.iso > tsMax) tsMax = clock.iso;
    }
    if (iBk >= 0 && cols[iBk]) books.add(cols[iBk]!.trim());
    if (iFt >= 0 && (cols[iFt] ?? "").trim() !== "") hasFt = true;
    if (iTeams >= 0 && /[\u4e00-\u9fff]/.test(cols[iTeams] ?? "")) cjk = true;
  }
  const parts = relPath.replace(/\\/g, "/").split("/");
  const league = parts.includes("sample") ? (parts[parts.indexOf("sample") + 1] ?? null) : (parts[0] ?? null);
  const fname = parts[parts.length - 1] ?? relPath;
  const mid = fname.match(/match_(\d+)/)?.[1] ?? null;
  return {
    path: relPath,
    league: league && league.endsWith(".csv") ? null : league,
    match_id: mid,
    rows: Math.max(0, lines.length - 1),
    exact_timestamps: exact,
    bookmakers: [...books].slice(0, 20),
    ts_min: tsMin,
    ts_max: tsMax,
    has_ft_score: hasFt,
    teams_look_cjk: cjk,
    kickoff_in_file: false,
  };
}

function walkCsvs(dir: string, acc: string[] = [], prefix = ""): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(p).isDirectory()) walkCsvs(p, acc, rel);
    else if (name.toLowerCase().endsWith(".csv")) acc.push(rel);
  }
  return acc;
}

function extractZip(zipPath: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  execFileSync("tar", ["-xf", zipPath, "-C", dest], { stdio: "ignore" });
}

export function inspectKaggleAh(opts?: { skipFull?: boolean }): KaggleAhInspect026 {
  const zip = kaggleAhZipPath();
  const zipPresent = existsSync(zip);
  const mini = inspectAhCsv(readFileSync(kaggleAhMiniPath(), "utf8"), "fixtures/kaggle-ah-mini.csv");
  if (!zipPresent || opts?.skipFull) {
    return {
      zip_present: zipPresent,
      zip_bytes: zipPresent ? statSync(zip).size : null,
      claimed_matches: 7494,
      public_csv_files: 0,
      exact_timestamp_events: mini.exact_timestamps > 0 ? 1 : 0,
      quote_rows: mini.rows,
      license: "UNKNOWN",
      provenance: "titan007.com (README)",
      kickoff_column: false,
      ft_in_odds_file: true,
      claimed_roi_used: false,
      files: [mini],
      note: zipPresent
        ? "zip on disk but skipFull — committed mini fixture only"
        : "zip missing — committed mini fixture only (3 SOURCE_TIMESTAMP rows, no kickoff)",
    };
  }
  const dest = join(TASK026_CACHE_DIR, "kaggle-ah");
  if (!existsSync(join(dest, "README.md"))) {
    extractZip(zip, dest);
  }
  const rels = walkCsvs(dest);
  const files = rels.map((rel) => inspectAhCsv(readFileSync(join(dest, rel), "utf8"), rel));
  const withClock = files.filter((f) => f.exact_timestamps > 0);
  return {
    zip_present: true,
    zip_bytes: statSync(zip).size,
    claimed_matches: 7494,
    public_csv_files: files.length,
    exact_timestamp_events: withClock.length,
    quote_rows: files.reduce((n, f) => n + f.rows, 0),
    license: "UNKNOWN",
    provenance: "titan007.com (README)",
    kickoff_column: false,
    ft_in_odds_file: true,
    claimed_roi_used: false,
    files,
    note:
      `Public Kaggle zip is SAMPLE only (${files.length} CSVs, not 7494). Timestamp=YYYYMMDDHHmmss claimed UTC. ` +
      `No kickoff column. FT/HT sit on every odds row — ignored for DecisionContext. License UNKNOWN.`,
  };
}
