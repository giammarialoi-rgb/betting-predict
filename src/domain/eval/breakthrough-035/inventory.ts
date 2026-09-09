import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { InventoryFile035, TemporalClass035 } from "@/domain/eval/breakthrough-035/types";

const SKIP_DIR = new Set(["node_modules", ".next", ".git", "terminals", "agent-transcripts"]);

const EXT = new Set([
  ".csv",
  ".json",
  ".jsonl",
  ".ndjson",
  ".bz2",
  ".gz",
  ".zip",
  ".parquet",
  ".sql",
  ".sqlite",
  ".db",
  ".txt",
  ".md",
]);

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) {
      const lower = e.name.toLowerCase();
      const ext = extname(lower);
      if (EXT.has(ext) || lower.endsWith(".csv.gz") || lower.endsWith(".json.gz")) out.push(p);
    }
  }
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const s = createReadStream(path);
    s.on("data", (c) => hash.update(c));
    s.on("end", () => resolve());
    s.on("error", reject);
  });
  return hash.digest("hex");
}

function profile(rel: string): Omit<InventoryFile035, "path" | "bytes" | "sha256" | "hashed"> {
  const p = rel.replaceAll("\\", "/").toLowerCase();
  const base = {
    rows: null as number | null,
    date_min: null as string | null,
    date_max: null as string | null,
    competitions: [] as string[],
    markets: [] as string[],
    bookmakers: [] as string[],
    kickoff: null as boolean | null,
    quote_timestamp: null as boolean | null,
    timezone: null as string | null,
    timestamp_semantics: "not profiled as odds",
    availability: "N/A" as InventoryFile035["availability"],
    match_exact_possible: null as boolean | null,
    license: "see catalog / file header",
    provenance: rel,
    temporal_level: "NOT_ODDS" as InventoryFile035["temporal_level"],
    strict_usable: false,
    exclusion: "Not an odds clock file, or already classified in prior tasks.",
  };
  if (p.includes("task-027/strict-candidates.csv")) {
    return {
      ...base,
      rows: 10499,
      date_min: "2015-09-01",
      date_max: "2016-11-19",
      competitions: ["multi-league BeatTheBookie"],
      markets: ["1X2"],
      bookmakers: ["multi"],
      kickoff: true,
      quote_timestamp: true,
      timezone: "UTC kickoff (soccer-dataset); quote = T−1h bin",
      timestamp_semantics: "LEVEL_B reconstructed hours_before=1, not exchange publishTime",
      availability: "SNAPSHOT",
      match_exact_possible: true,
      license: "GPL-3.0 upstream + CC BY 4.0 kickoff",
      provenance: "TASK_031_BASE frozen. SHA 6d78ca34…44174b",
      temporal_level: "LEGACY_STRICT_B",
      strict_usable: false,
      exclusion: "Legacy STRICT_B 2015–16 only. Not a 035 breakthrough. File not rewritten.",
    };
  }
  if (p.includes("task-029/books-t1h")) {
    return { ...base, markets: ["1X2"], kickoff: true, quote_timestamp: true, temporal_level: "LEGACY_STRICT_B", exclusion: "031 overlay. No new years." };
  }
  if (p.includes("task-030/movement-t24")) {
    return { ...base, markets: ["1X2"], kickoff: true, quote_timestamp: true, availability: "SNAPSHOT", temporal_level: "LEGACY_STRICT_B", exclusion: "T−24 overlay only." };
  }
  if (p.includes("betfair_140901") || p.includes("betfair-sports.csv")) {
    return {
      ...base,
      date_min: "2014-09",
      date_max: "2014-09",
      markets: ["exchange"],
      bookmakers: ["Betfair"],
      kickoff: true,
      quote_timestamp: true,
      timezone: null,
      timestamp_semantics: "naive FIRST_TAKEN / SCHEDULED_OFF",
      availability: "STREAM",
      temporal_level: "RESEARCH_TEMPORAL",
      exclusion: "Naive TZ. Not STRICT.",
    };
  }
  if (p.includes("hf-soccer_odds")) {
    return {
      ...base,
      rows: 81,
      date_min: "2024-07-26",
      date_max: "2024-07-26",
      competitions: ["Brazil Série B"],
      markets: ["h2h"],
      bookmakers: ["multi Odds-API"],
      kickoff: true,
      quote_timestamp: true,
      timezone: null,
      timestamp_semantics: "naive commence_time / bookmaker_last_update",
      availability: "SNAPSHOT",
      match_exact_possible: false,
      temporal_level: "AMBIGUOUS",
      exclusion: "n=1. Naive TZ. No FT.",
    };
  }
  if (p.includes("hf-olivier-sample")) {
    return {
      ...base,
      rows: 380,
      date_min: "1998-01-06",
      date_max: null,
      markets: ["1X2 closing"],
      kickoff: false,
      quote_timestamp: false,
      timestamp_semantics: "calendar Date + Closing_Odds_*",
      availability: "CLOSE",
      temporal_level: "DATE_ONLY",
      exclusion: "Closing date-only sample.",
    };
  }
  if (p.includes("hf-5dollar-inplay")) {
    return {
      ...base,
      rows: 347,
      date_min: "2025-08-16",
      date_max: "2026",
      competitions: ["Premier League"],
      markets: ["1X2 in-play"],
      bookmakers: ["Bet365"],
      kickoff: true,
      quote_timestamp: true,
      timezone: "named Beijing, undocumented conversion",
      timestamp_semantics: "in-play around first goal",
      availability: "STREAM",
      temporal_level: "POSTMATCH",
      exclusion: "quote ≥ kickoff.",
    };
  }
  if (p.includes("sharpapi-wc2026")) {
    return {
      ...base,
      rows: 6132,
      date_min: "2026-07-13",
      date_max: "2026-07-14",
      competitions: ["FIFA World Cup 2026"],
      markets: ["moneyline", "outright", "player", "totals"],
      bookmakers: ["23 sources"],
      kickoff: true,
      quote_timestamp: true,
      timezone: "UTC (ISO-Z)",
      timestamp_semantics: "single capture timestamp; event_start_time mix of kickoff and futures close",
      availability: "SNAPSHOT",
      match_exact_possible: false,
      license: "CC BY 4.0",
      temporal_level: "RESEARCH_TEMPORAL",
      exclusion: "No FT. n moneyline matches = 4. Midnight starts ambiguous.",
    };
  }
  if (p.includes("ia-e0-1920") || p.includes("fd-e0-probe")) {
    return {
      ...base,
      date_min: "2019-08",
      date_max: "2020-07",
      competitions: ["E0"],
      markets: ["1X2", "OU", "AH"],
      bookmakers: ["B365", "BW", "IW", "PS", "WH", "VC"],
      kickoff: true,
      quote_timestamp: false,
      timezone: null,
      timestamp_semantics: "Date+Time kickoff; odds are collection-window / closing columns",
      availability: "OPEN_CLOSE",
      match_exact_possible: false,
      temporal_level: "DATE_ONLY",
      exclusion: "Internet Archive copy of football-data.co.uk. Not a quote clock.",
    };
  }
  if (p.includes("hf-soccer_stats.sql")) {
    return {
      ...base,
      timestamp_semantics: "pg_dump custom; soccer_odds timestamp without time zone",
      temporal_level: "AMBIGUOUS",
      exclusion: "Binary dump of the same naive soccer_odds table.",
    };
  }
  if (p.includes("kaggle-ah")) {
    return {
      ...base,
      markets: ["AH"],
      kickoff: false,
      quote_timestamp: true,
      timezone: null,
      timestamp_semantics: "compact YYYYMMDDHHMMSS naive",
      availability: "STREAM",
      temporal_level: "RESEARCH_TEMPORAL",
      exclusion: "No kickoff column.",
    };
  }
  if (p.includes("task-024/odds.parquet")) {
    return {
      ...base,
      markets: ["1X2"],
      kickoff: true,
      quote_timestamp: true,
      timestamp_semantics: "known_at = kickoff (closing)",
      availability: "CLOSE",
      temporal_level: "DATE_ONLY",
      exclusion: "Closing as-of kickoff.",
    };
  }
  if (p.includes("task-023/football-basic")) {
    return {
      ...base,
      rows: 1,
      markets: ["MATCH_ODDS"],
      bookmakers: ["Betfair"],
      kickoff: true,
      quote_timestamp: true,
      timezone: "UTC publishTime",
      timestamp_semantics: "official BASIC stream sample",
      availability: "STREAM",
      temporal_level: "RESEARCH_TEMPORAL",
      exclusion: "n=1 mirror of Betfair Historic.",
    };
  }
  if (p.startsWith("docs/") || p.startsWith("artifacts/")) {
    return { ...base, exclusion: "Lab artifact or documentation, not a raw odds archive." };
  }
  return base;
}

export async function inventoryFilesystem035(input: {
  root?: string;
  hashMaxBytes: number;
  skipHeavy?: boolean;
}): Promise<{ files: InventoryFile035[]; roots_missing: string[] }> {
  const root = input.root ?? process.cwd();
  const roots = input.skipHeavy
    ? ["docs", "artifacts", "src/domain/eval/breakthrough-035/fixtures"]
    : ["artifacts", "audit", "data", "datasets", "docs", "scripts", "src/scripts", "tmp", "cache"];
  const missing: string[] = [];
  const paths: string[] = [];
  for (const r of roots) {
    const p = join(root, r);
    if (!existsSync(p)) missing.push(r);
    else walk(p, paths);
  }
  paths.sort();
  const files: InventoryFile035[] = [];
  for (const p of paths) {
    const st = statSync(p);
    const hashed = st.size <= input.hashMaxBytes;
    const rel = relative(root, p).replaceAll("\\", "/");
    files.push({
      path: rel,
      bytes: st.size,
      sha256: hashed ? await sha256File(p) : null,
      hashed,
      ...profile(rel),
    });
  }
  return { files, roots_missing: missing };
}

export function countTemporal(files: readonly InventoryFile035[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) {
    const k = f.temporal_level;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function isOddsClockClass(c: TemporalClass035 | "LEGACY_STRICT_B" | "NOT_ODDS"): boolean {
  return c !== "NOT_ODDS";
}
