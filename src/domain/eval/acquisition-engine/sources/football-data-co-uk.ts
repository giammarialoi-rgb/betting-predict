/**
 * football-data.co.uk historical CSV. Scores DATE_ONLY. Odds columns ignored (MARKET).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { ensureAcquisitionDataSource } from "@/domain/eval/acquisition-engine/persist";
import type { AcquisitionRecord, SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

const MARKET_COLUMNS = /^(B365|PS|WH|BW|IW|VC|Avg|Max|Bb)/i;

export function countResultRows(csvText: string): { rows: number; odds_columns_ignored: number } {
  const table = parseCsv(csvText);
  const oddsCols = table.headers.filter((h) => MARKET_COLUMNS.test(h)).length;
  let rows = 0;
  for (const row of table.rows) {
    if (row.HomeTeam && row.AwayTeam && row.Date) rows += 1;
  }
  return { rows, odds_columns_ignored: oddsCols };
}

export async function runFootballDataCoUkLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  csvText?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  let text = input.csvText;
  let http = 200;
  let retries = 0;
  let url = input.url;

  if (text == null) {
    const got = await acquisitionGet({
      url: input.url,
      sourceId: "football-data-co-uk",
      minIntervalMs: 2_000,
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    text = got.text;
    http = got.status;
    retries = got.retries;
    url = got.url;
    if (!got.ok) {
      return emptyLane({
        source_id: "football-data-co-uk",
        url,
        status: http === 403 ? "BLOCKED" : http === 429 ? "RATE_LIMITED" : "NETWORK_ERROR",
        http_status: http || null,
        retries,
        reason: got.error ?? `HTTP_${http}`,
        reason_it:
          http === 403
            ? "football-data.co.uk ha restituito HTTP 403. Il CSV resta CACHE_ONLY se presente in locale. Nessun dato inventato."
            : `football-data.co.uk non disponibile (HTTP ${http || "?"}).`,
      });
    }
  }

  if (!/HomeTeam/i.test(text.slice(0, 400))) {
    return emptyLane({
      source_id: "football-data-co-uk",
      url,
      status: "PARSE_ERROR",
      http_status: http,
      retries,
      reason: "NOT_CSV",
      reason_it: "La risposta di football-data.co.uk non e un CSV di risultati. Nessun dato inventato.",
    });
  }

  const counted = countResultRows(text);
  const cacheDir = join(input.cwd, "data", "acquisition", "football-data-co-uk");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, "E0.csv");
  writeFileSync(cachePath, text, "utf8");

  const records: AcquisitionRecord[] = [
    {
      source_id: "football-data-co-uk",
      kind: "results",
      feature_key: "fdouk_result_rows",
      value: counted.rows,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "date_only",
      feature_status: "NOT_ELIGIBLE",
      enters_independent_model: false,
      extraction_method: "football_data_co_uk_csv_results_only",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `${counted.rows} righe risultato. Quote ignorate (${counted.odds_columns_ignored} colonne MARKET). DATE_ONLY, non exact.`,
    },
  ];

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    try {
      const id = await ensureAcquisitionDataSource({
        slug: "football-data-co-uk",
        name: "football-data.co.uk",
        licenseClass: "dataset",
      });
      neon = {
        source_registered: Boolean(id),
        elo_stored: 0,
        features_stored: 0,
        reason: id ? null : "DATABASE_URL not set or insert failed",
      };
    } catch (e) {
      neon.reason = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    source_id: "football-data-co-uk",
    ok: counted.rows > 0,
    fetched: true,
    status: counted.rows > 0 ? "OK" : "NO_DATA",
    http_status: http,
    url,
    records,
    fields_extracted: counted.rows > 0 ? ["fdouk_result_rows"] : [],
    reason: `rows=${counted.rows}; odds_columns_ignored=${counted.odds_columns_ignored}`,
    reason_it: `football-data.co.uk: ${counted.rows} risultati DATE_ONLY. Le quote restano layer di mercato.`,
    retries,
    cache_path: cachePath,
    neon,
  };
}
