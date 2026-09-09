import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { classifyWeeklyBetfairRow } from "@/domain/eval/turnaround-025/classify";
import { KAGGLE_CACHE } from "@/domain/eval/turnaround-025/config";
import {
  KAGGLE_BETFAIR_SPORTS,
  parseWeeklyBetfairCsv,
  parseWeeklyBetfairLine,
  splitCsvLine,
} from "@/domain/eval/turnaround-025/kaggle-betfair";
import type { DataClass025 } from "@/domain/eval/turnaround-025/types";

export function kaggleWeekSamplePath(): string {
  return join(process.cwd(), "src", "domain", "eval", "turnaround-025", "fixtures", "kaggle-week-sample.csv");
}

export type KaggleInspect025 = {
  bulk_acquired: boolean;
  bulk_bytes: number | null;
  bulk_sha256: string | null;
  sample_rows: number;
  class_counts: Record<DataClass025, number>;
  unique_events_sample: number;
  soccer_rows: number;
  soccer_events: number;
  license: string;
  meta: typeof KAGGLE_BETFAIR_SPORTS;
};

function emptyCounts(): Record<DataClass025, number> {
  return { A_STRICT: 0, B_RESEARCH_TEMPORAL: 0, C_RESEARCH_ONLY: 0, D_INVALID: 0 };
}

export async function inspectKaggleWeekly(opts?: { skipBulk?: boolean }): Promise<KaggleInspect025> {
  const sample = parseWeeklyBetfairCsv(readFileSync(kaggleWeekSamplePath(), "utf8"));
  const class_counts = emptyCounts();
  const events = new Set<string>();
  let soccer_rows = 0;
  const soccerEvents = new Set<string>();
  for (const row of sample) {
    class_counts[classifyWeeklyBetfairRow(row).dataClass] += 1;
    events.add(row.event_id);
    if (row.sports_id === "1") {
      soccer_rows += 1;
      soccerEvents.add(row.event_id);
    }
  }
  if (!existsSync(KAGGLE_CACHE) || opts?.skipBulk) {
    return {
      bulk_acquired: existsSync(KAGGLE_CACHE) && opts?.skipBulk !== true,
      bulk_bytes: existsSync(KAGGLE_CACHE) && opts?.skipBulk !== true ? statSync(KAGGLE_CACHE).size : null,
      bulk_sha256: null,
      sample_rows: sample.length,
      class_counts,
      unique_events_sample: events.size,
      soccer_rows,
      soccer_events: soccerEvents.size,
      license: KAGGLE_BETFAIR_SPORTS.license,
      meta: KAGGLE_BETFAIR_SPORTS,
    };
  }
  const hash = createHash("sha256");
  const rl = createInterface({
    input: createReadStream(KAGGLE_CACHE, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  const bulkCounts = emptyCounts();
  const bulkEvents = new Set<string>();
  let rows = 0;
  soccer_rows = 0;
  soccerEvents.clear();
  for await (const line of rl) {
    hash.update(line);
    hash.update("\n");
    if (!header) {
      header = splitCsvLine(line).map((h) => h.trim().toUpperCase());
      continue;
    }
    if (line.trim() === "") continue;
    const row = parseWeeklyBetfairLine(header, line);
    if (!row) continue;
    rows += 1;
    bulkCounts[classifyWeeklyBetfairRow(row).dataClass] += 1;
    bulkEvents.add(row.event_id);
    if (row.sports_id === "1") {
      soccer_rows += 1;
      soccerEvents.add(row.event_id);
    }
  }
  return {
    bulk_acquired: true,
    bulk_bytes: statSync(KAGGLE_CACHE).size,
    bulk_sha256: hash.digest("hex"),
    sample_rows: rows,
    class_counts: bulkCounts,
    unique_events_sample: bulkEvents.size,
    soccer_rows,
    soccer_events: soccerEvents.size,
    license: KAGGLE_BETFAIR_SPORTS.license,
    meta: KAGGLE_BETFAIR_SPORTS,
  };
}
