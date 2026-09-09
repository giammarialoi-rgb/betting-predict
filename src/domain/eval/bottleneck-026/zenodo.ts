/**
 * Zenodo 10.5281/zenodo.12673394 — UCD replication package.
 * football-data.co.uk lineage. Date/Time are match dates / kickoff, not quote clocks.
 */

import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { zenodoRawZipPath } from "@/domain/eval/bottleneck-026/acquire";
import { TASK026_CACHE_DIR } from "@/domain/eval/bottleneck-026/config";
import { classifyClock } from "@/domain/eval/bottleneck-026/classify";

export type ZenodoInspect026 = {
  zip_present: boolean;
  zip_bytes: number | null;
  license: "CC-BY-4.0";
  raw_rows: number | null;
  header: string[];
  date_precision: ReturnType<typeof classifyClock>["precision"];
  has_quote_timestamp: false;
  kickoff_is_not_quote_clock: true;
  corpus_level: "RESEARCH_DATE_ONLY";
  note: string;
};

function extractIfNeeded(): string | null {
  const zip = zenodoRawZipPath();
  if (!existsSync(zip)) return null;
  const dest = join(TASK026_CACHE_DIR, "zenodo");
  const csv = join(dest, "Raw to Tidy Data", "raw_data1.0.csv");
  if (!existsSync(csv)) {
    mkdirSync(dest, { recursive: true });
    execFileSync("tar", ["-xf", zip, "-C", dest], { stdio: "ignore" });
  }
  return existsSync(csv) ? csv : null;
}

export async function inspectZenodoUcd(opts?: { skipFull?: boolean }): Promise<ZenodoInspect026> {
  const zip = zenodoRawZipPath();
  const zipPresent = existsSync(zip);
  const base: Omit<ZenodoInspect026, "raw_rows" | "header" | "date_precision"> = {
    zip_present: zipPresent,
    zip_bytes: zipPresent ? statSync(zip).size : null,
    license: "CC-BY-4.0",
    has_quote_timestamp: false,
    kickoff_is_not_quote_clock: true,
    corpus_level: "RESEARCH_DATE_ONLY",
    note:
      "Hegarty/Whelan IJF replication. Odds from football-data.co.uk (collected 2022-05-22). " +
      "OPEN/CLOSE bookmaker columns are DATE_ONLY. Time in tidy notes is kickoff, not a quote timestamp.",
  };
  if (!zipPresent || opts?.skipFull) {
    return {
      ...base,
      raw_rows: null,
      header: [],
      date_precision: "DATE_ONLY",
    };
  }
  const csv = extractIfNeeded();
  if (!csv) {
    return { ...base, raw_rows: null, header: [], date_precision: "DATE_ONLY" };
  }
  const rl = createInterface({ input: createReadStream(csv, { encoding: "utf8" }), crlfDelay: Infinity });
  let header: string[] = [];
  let rows = 0;
  let sampleDate = "";
  for await (const line of rl) {
    if (header.length === 0) {
      header = line.split(",").map((h) => h.trim());
      continue;
    }
    if (line.trim() === "") continue;
    rows += 1;
    if (!sampleDate) {
      const cols = line.split(",");
      const i = header.findIndex((h) => /date/i.test(h));
      if (i >= 0) sampleDate = cols[i] ?? "";
    }
  }
  const date_precision = classifyClock({ raw: sampleDate || "05/08/2005", origin: "SOURCE_TIMESTAMP" }).precision;
  return { ...base, raw_rows: rows, header, date_precision };
}
