/**
 * Year / market inventory — honest coverage, no fabrication.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import type { RealHistoricalDataset } from "@/domain/eval/real-lab/load-pack";
import { loadExp017Config } from "@/domain/eval/actuarial-017/exp017-config";

export type YearInventoryRow = {
  year: number;
  events_usable_primary: number;
  events_excluded: number;
  exclusion_reason: string;
  quality: "OK" | "INSUFFICIENT_DATA" | "INCOMPLETE_YEAR" | "SECONDARY_ONLY_CATALOGUED";
  secondary_catalogued_bucket: string | null;
};

export type MarketInventoryRow = {
  market: string;
  observed: boolean;
  temporally_validated: boolean;
  model_ready: boolean;
  n_primary: number;
  status: "ADMITTED" | "BLOCKED" | "CATALOGUED_ONLY";
};

function clubFootballExternalPresent(): boolean {
  return existsSync(CLUB_FOOTBALL_MATCHES_CSV);
}

function loadSecondaryCoverageBuckets(): Record<string, number> {
  const path = join(
    process.cwd(),
    "audit",
    "club-football-match-data",
    "coverage.csv",
  );
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(1);
  const out: Record<string, number> = {};
  for (const line of lines) {
    const [bucket, matches] = line.split(",");
    if (!bucket || bucket === "invalid_date") continue;
    out[bucket] = Number(matches) || 0;
  }
  return out;
}

function bucketForYear(year: number): string | null {
  if (year >= 2000 && year <= 2005) return "2000-2005";
  if (year >= 2006 && year <= 2010) return "2005-2010";
  if (year >= 2011 && year <= 2015) return "2010-2015";
  if (year >= 2016 && year <= 2020) return "2015-2020";
  if (year >= 2021 && year <= 2025) return "2020-2025";
  if (year >= 2026) return "2025+";
  return null;
}

export function buildYearInventory(dataset: RealHistoricalDataset): YearInventoryRow[] {
  const cfg = loadExp017Config();
  const byYear = new Map<number, number>();
  for (const e of dataset.events) {
    const y = e.scheduledStartAt.getUTCFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const secondary = loadSecondaryCoverageBuckets();
  const external = clubFootballExternalPresent();

  return cfg.solar_years_requested.map((year) => {
    const usable = byYear.get(year) ?? 0;
    const bucket = bucketForYear(year);
    if (usable > 0) {
      return {
        year,
        events_usable_primary: usable,
        events_excluded: 0,
        exclusion_reason: "none",
        quality: year >= 2025 ? "INCOMPLETE_YEAR" : "OK",
        secondary_catalogued_bucket: bucket,
      };
    }
    if (year >= 2025) {
      return {
        year,
        events_usable_primary: 0,
        events_excluded: 0,
        exclusion_reason: "incomplete_year_no_primary_events",
        quality: "INCOMPLETE_YEAR",
        secondary_catalogued_bucket: bucket,
      };
    }
    const secCount = bucket ? secondary[bucket] ?? 0 : 0;
    return {
      year,
      events_usable_primary: 0,
      events_excluded: secCount,
      exclusion_reason: external
        ? "secondary_club_football_present_but_STRICT_blind_bankroll_excludes_undocumented_odds_clocks"
        : "INSUFFICIENT_DATA_primary_pack_missing; secondary_clone_absent; audit_coverage_catalogued_only",
      quality:
        secCount > 0 ? "SECONDARY_ONLY_CATALOGUED" : "INSUFFICIENT_DATA",
      secondary_catalogued_bucket: bucket,
    };
  });
}

export function buildMarketInventory(dataset: RealHistoricalDataset): MarketInventoryRow[] {
  const cfg = loadExp017Config();
  const resultQuotes = dataset.quotes.filter(
    (q) => q.observation.marketType === "result",
  );
  const ou = dataset.quotes.filter(
    (q) => q.observation.marketType === "total_goals",
  );
  const rows: MarketInventoryRow[] = [
    {
      market: "result",
      observed: resultQuotes.length > 0,
      temporally_validated: false,
      model_ready: false,
      n_primary: resultQuotes.length,
      status: "ADMITTED",
    },
  ];
  for (const m of cfg.markets_blocked) {
    const n =
      m === "total_goals"
        ? ou.length
        : 0;
    rows.push({
      market: m,
      observed: n > 0,
      temporally_validated: false,
      model_ready: false,
      n_primary: n,
      status: n > 0 ? "CATALOGUED_ONLY" : "BLOCKED",
    });
  }
  return rows;
}

export function secondaryDatasetManifest() {
  const cfg = loadExp017Config();
  const summaryPath = join(process.cwd(), cfg.secondary_dataset.audit_summary);
  let audit: Record<string, unknown> | null = null;
  if (existsSync(summaryPath)) {
    audit = JSON.parse(readFileSync(summaryPath, "utf8")) as Record<
      string,
      unknown
    >;
  }
  return {
    ...cfg.secondary_dataset,
    external_matches_csv_present: clubFootballExternalPresent(),
    audit_present: audit != null,
    commit_sha: cfg.secondary_dataset.commit_sha_from_audit,
    retrieved_at: audit?.retrieved_at ?? null,
    row_count_from_audit:
      (audit?.files as Array<{ row_count?: number }> | undefined)?.[0]
        ?.row_count ?? null,
  };
}
