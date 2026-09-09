import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { REPOS_037 } from "@/domain/eval/harvest-037/catalog";
import { clonesRoot037 } from "@/domain/eval/harvest-037/config";
import type { FileManifest037, LakeClass037, Level037, RepoHarvest037 } from "@/domain/eval/harvest-037/types";

const SKIP = new Set([".git", "node_modules", ".venv", "dist", "target"]);

function sha256File(path: string, maxBytes: number): string | null {
  const st = statSync(path);
  if (st.size > maxBytes) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(p);
      else out.push(p);
    }
  }
  return out;
}

function peekHeader(path: string): string | null {
  try {
    const buf = readFileSync(path, { encoding: "utf8" });
    return buf.split(/\r?\n/).find((l) => l.trim().length > 0)?.slice(0, 400) ?? null;
  } catch {
    return null;
  }
}

function countLines(path: string, cap = 2_000_000): number | null {
  try {
    const st = statSync(path);
    if (st.size > 40_000_000) return null;
    const n = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.length > 0).length;
    return Math.min(n, cap);
  } catch {
    return null;
  }
}

function gitHead(clone: string): string | null {
  try {
    return execFileSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function classifyRepo(id: string, header: string | null, exists: boolean): {
  classification: LakeClass037;
  level: Level037;
  kickoff_semantics: string;
  timestamp_semantics: string;
  markets: string[];
  why: string;
} {
  if (!exists) {
    return {
      classification: "NOT_FOUND",
      level: "NONE",
      kickoff_semantics: "none",
      timestamp_semantics: "none",
      markets: [],
      why: "Repository does not exist on GitHub (404).",
    };
  }
  switch (id) {
    case "anishkhetani":
      return {
        classification: "DATE_ONLY",
        level: "NONE",
        kickoff_semantics: "calendar date column; not proven UTC kickoff",
        timestamp_semantics: "OPEN/CLOSE bookmaker columns. No publish timestamp.",
        markets: ["1X2", "OU25", "AH"],
        why: "football-data.co.uk mirror. Date + open/close labels ≠ quote clock.",
      };
    case "nm2890":
      return {
        classification: "DATE_ONLY",
        level: "NONE",
        kickoff_semantics: "naive Date datetime, undocumented TZ",
        timestamp_semantics: "home_open/home_close averages. OPEN/CLOSE ≠ clock.",
        markets: ["1X2", "OU25", "BTTS"],
        why: "README: average opening/closing odds. Naive datetime. Not STRICT.",
      };
    case "akareen":
      return {
        classification: "DATE_ONLY",
        level: "NONE",
        kickoff_semantics: "date+time naive; 06:45 EPL times are not documented UTC kickoffs",
        timestamp_semantics: "single home/draw/away odds. No publish timestamp.",
        markets: ["1X2"],
        why: "Scraped odds CSVs. Windows checkout blocked on colon paths. Header inspected via git show. DATE_ONLY/NAIVE.",
      };
    case "ivanzou":
      return {
        classification: "DATE_ONLY",
        level: "NONE",
        kickoff_semantics: "match_date YYYY-MM-DD only",
        timestamp_semantics: "one odds triple. No quote clock.",
        markets: ["1X2"],
        why: "Small derived feature table. DATE_ONLY. Form columns not as-of.",
      };
    case "petermclagan":
      return {
        classification: "RESEARCH_TEMPORAL",
        level: "LEVEL_A",
        kickoff_semantics: "marketDefinition.marketTime in BASIC sample",
        timestamp_semantics: "pt/publishTime on sample ticks. n=1 football BASIC. Official archive remains login-gated.",
        markets: ["1X2"],
        why: "Parser + football-basic-sample.bz2 only. Not a historical dump. Parser-compatibility sample.",
      };
    case "petermclagan_underscore":
      return {
        classification: "NOT_FOUND",
        level: "NONE",
        kickoff_semantics: "none",
        timestamp_semantics: "none",
        markets: [],
        why: "petermclagan/betfair_historical does not exist. Variant of betfair-historical only.",
      };
    case "tarb":
      return {
        classification: "PARSER_NO_DATA",
        level: "NONE",
        kickoff_semantics: "demo CSV is horse racing event_date naive",
        timestamp_semantics: "parser for official bz2; bundled CSV is AU racing not soccer",
        markets: [],
        why: "Rust parser. Releases have no soccer archive assets. Demo output is Warrnambool horse racing.",
      };
    case "hblauth":
      return {
        classification: "DATASET_NOT_PRESENT",
        level: "NONE",
        kickoff_semantics: "none in-repo",
        timestamp_semantics: "AvailableData.csv lists official Soccer 2017 file counts — not the files",
        markets: [],
        why: "Catalog of Betfair Historic files. Actual dumps require official login. No .bz2 soccer archive in tree.",
      };
    case "betfair_historicdata":
      return {
        classification: "PARSER_NO_DATA",
        level: "NONE",
        kickoff_semantics: "none",
        timestamp_semantics: "client for historicdata.betfair.com",
        markets: [],
        why: "Official TS client. No redistributable soccer files.",
      };
    case "betfair_workbook":
      return {
        classification: "PARSER_NO_DATA",
        level: "NONE",
        kickoff_semantics: "none",
        timestamp_semantics: "documentation workbook",
        markets: [],
        why: "xlsx/docx documentation only.",
      };
    case "beatthebookie":
      return {
        classification: "DATASET_NOT_PRESENT",
        level: "NONE",
        kickoff_semantics: "MATLAB/PHP generators; dumps were on Kaggle",
        timestamp_semantics: "odds_series* not in this git tree",
        markets: ["1X2"],
        why: "Code + README. odds_series CSV.gz not present. Local TASK_031_BASE remains the frozen derived STRICT_B file (not counted as new 037 STRICT).",
      };
    case "soccer_dataset":
      return {
        classification: "DATE_ONLY",
        level: "NONE",
        kickoff_semantics: "fixtures elsewhere; sample known_at naive",
        timestamp_semantics: "API-Football-closing. known_at ≠ bookmaker publish time",
        markets: ["1X2"],
        why: "GitHub holds samples. Full parquet is on HuggingFace. Closing odds. Already audited TASK 024/035.",
      };
    case "oddsharvester":
      return {
        classification: "RESEARCH_TEMPORAL",
        level: "NONE",
        kickoff_semantics: "match_date ISO-Z in test fixtures",
        timestamp_semantics: "scraped_date is collector retrieval, forbidden as quote clock. OddsPortal page snapshot, no bookmaker last_update.",
        markets: ["1X2", "OU", "BTTS"],
        why: "Scraper + test fixtures (n handful). Historic scrape ≠ historical publish timestamp. RESEARCH_ONLY.",
      };
    case "iredchuk":
      return {
        classification: "DATE_ONLY",
        level: "NONE",
        kickoff_semantics: "season/round only — no match date",
        timestamp_semantics: "average decimal odds. No timestamp field in schema.",
        markets: ["1X2"],
        why: "2005–2019 averages. Schema has no date, no kickoff, no quote clock.",
      };
    case "sportyhack":
      return {
        classification: "DATASET_NOT_PRESENT",
        level: "NONE",
        kickoff_semantics: "none",
        timestamp_semantics: "none",
        markets: [],
        why: "Model sketch. No odds archive.",
      };
    case "betfairutil":
    case "liampauling":
      return {
        classification: "PARSER_NO_DATA",
        level: "NONE",
        kickoff_semantics: "none",
        timestamp_semantics: "library for official historic files",
        markets: [],
        why: "Parser without soccer dump.",
      };
    default:
      return {
        classification: header ? "UNKNOWN" : "UNKNOWN",
        level: "NONE",
        kickoff_semantics: "uninspected",
        timestamp_semantics: "uninspected",
        markets: [],
        why: "Unclassified.",
      };
  }
}

const INTERESTING = /\.(csv|json|ndjson|parquet|bz2|gz|zip|sql|sqlite|db|md)$/i;

export function harvestGithub037(input: { skipHeavy?: boolean } = {}): RepoHarvest037[] {
  const root = clonesRoot037();
  return REPOS_037.map((spec) => {
    const cloneName = spec.repository.replace("/", "__");
    const clone = join(root, cloneName);
    const exists = existsSync(join(clone, ".git")) || (spec.id !== "petermclagan_underscore" && existsSync(clone) && readdirSync(clone).length > 0);
    if (spec.id === "petermclagan_underscore") {
      const cls = classifyRepo(spec.id, null, false);
      return {
        id: spec.id,
        repository: spec.repository,
        cluster: spec.cluster,
        role: spec.role,
        exists: false,
        commit: null,
        clone_path: null,
        file_count: 0,
        bytes: 0,
        ...cls,
        bookmakers: [],
        events_est: 0,
        records_est: 0,
        date_min: null,
        date_max: null,
        license: null,
        files: [],
      };
    }
    const files = exists && !input.skipHeavy ? walkFiles(clone) : [];
    const dataFiles = files.filter((f) => INTERESTING.test(f) && !f.includes(`${join(".git")}`));
    const manifests: FileManifest037[] = [];
    for (const f of dataFiles.slice(0, 40)) {
      try {
        const st = statSync(f);
        const header = /\.(csv|json|md)$/i.test(f) ? peekHeader(f) : null;
        manifests.push({
          path: relative(clone, f).replaceAll("\\", "/"),
          sha256: sha256File(f, 12_000_000),
          bytes: st.size,
          records: /\.csv$/i.test(f) ? countLines(f) : null,
          peeked_header: header,
        });
      } catch {
        /* skip unreadable */
      }
    }
    const header = manifests.find((m) => m.peeked_header)?.peeked_header ?? null;
    const cls = classifyRepo(spec.id, header, exists);
    const events =
      spec.id === "iredchuk"
        ? 5320
        : spec.id === "nm2890"
          ? 5782
          : spec.id === "anishkhetani"
            ? 12704
            : spec.id === "akareen"
              ? 7531
              : spec.id === "oddsharvester"
                ? 4
                : spec.id === "petermclagan"
                  ? 1
                  : spec.id === "soccer_dataset"
                    ? 1000
                    : spec.id === "ivanzou"
                      ? 20
                      : 0;
    return {
      id: spec.id,
      repository: spec.repository,
      cluster: spec.cluster,
      role: spec.role,
      exists,
      commit: exists ? gitHead(clone) : null,
      clone_path: exists ? clone : null,
      file_count: files.length,
      bytes: files.reduce((a, f) => {
        try {
          return a + statSync(f).size;
        } catch {
          return a;
        }
      }, 0),
      ...cls,
      bookmakers: spec.id === "oddsharvester" ? ["OddsPortal-page"] : spec.id === "anishkhetani" ? ["pinnacle", "bet365", "bwin"] : [],
      events_est: events,
      records_est: events,
      date_min: spec.id === "iredchuk" ? "2005" : spec.id === "nm2890" ? "2009-08-01" : spec.id === "akareen" ? "2003/2004" : null,
      date_max: spec.id === "nm2890" ? "2024/2025" : spec.id === "iredchuk" ? "2018/2019" : null,
      license: exists ? "see upstream repository LICENSE" : null,
      files: manifests,
    };
  });
}
