/**
 * football-data.co.uk historical CSV. Scores DATE_ONLY. Odds columns MARKET only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { persistCompareOnlyQuotes, registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import {
  FDOUK_DIVISIONS,
  currentFootballDataSeasonCode,
  footballDataCoUkCsvUrl,
} from "@/domain/eval/acquisition-engine/catalog";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

const MARKET_COLUMNS = /^(B365|PS|WH|BW|IW|VC|Avg|Max|Bb|BFD)/i;

export type FdoukResultRow = {
  home: string;
  away: string;
  date: string;
  division: string;
  fthg: string | null;
  ftag: string | null;
  b365h: number | null;
  b365d: number | null;
  b365a: number | null;
};

function decimalOdds(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

export function parseFdoukRows(csvText: string, divisionHint = ""): FdoukResultRow[] {
  const table = parseCsv(csvText);
  const out: FdoukResultRow[] = [];
  for (const row of table.rows) {
    const home = row.HomeTeam ?? "";
    const away = row.AwayTeam ?? "";
    const date = row.Date ?? "";
    if (!home || !away || !date) continue;
    out.push({
      home,
      away,
      date,
      division: row.Div ?? divisionHint,
      fthg: row.FTHG || null,
      ftag: row.FTAG || null,
      b365h: decimalOdds(row.B365H),
      b365d: decimalOdds(row.B365D),
      b365a: decimalOdds(row.B365A),
    });
  }
  return out;
}

export function countResultRows(csvText: string): { rows: number; odds_columns_ignored: number } {
  const table = parseCsv(csvText);
  const oddsCols = table.headers.filter((h) => MARKET_COLUMNS.test(h)).length;
  const rows = parseFdoukRows(csvText).length;
  return { rows, odds_columns_ignored: oddsCols };
}

export async function runFootballDataCoUkLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  persistLabB?: boolean;
  labBRoot?: string;
  csvText?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  labEvents?: AcquisitionCycleInput["labEvents"];
}): Promise<SourceLaneResult> {
  const cacheDir = join(input.cwd, "data", "acquisition", "football-data-co-uk");
  mkdirSync(cacheDir, { recursive: true });
  const day = input.nowIso.slice(0, 10);
  const season = currentFootballDataSeasonCode(day);

  const packs: Array<{ code: string; rows: FdoukResultRow[]; oddsCols: number; url: string }> = [];
  let http = 200;
  let retries = 0;
  let url = input.url;
  let lastError: string | null = null;

  if (input.csvText != null) {
    if (!/HomeTeam/i.test(input.csvText.slice(0, 400))) {
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
    const counted = countResultRows(input.csvText);
    writeFileSync(join(cacheDir, "E0.csv"), input.csvText, "utf8");
    packs.push({
      code: "E0",
      rows: parseFdoukRows(input.csvText, "E0"),
      oddsCols: counted.odds_columns_ignored,
      url: input.url,
    });
  } else {
    for (const div of FDOUK_DIVISIONS) {
      const got = await acquisitionGet({
        url: footballDataCoUkCsvUrl(season, div.code),
        sourceId: "football-data-co-uk",
        minIntervalMs: input.fetchImpl ? 0 : 2_000,
        fetchImpl: input.fetchImpl,
        maxRetries: input.maxRetries,
      });
      retries += got.retries;
      http = got.status;
      url = got.url;
      if (!got.ok) {
        lastError = got.error ?? `HTTP_${got.status}`;
        continue;
      }
      if (!/HomeTeam/i.test(got.text.slice(0, 400))) continue;
      const counted = countResultRows(got.text);
      writeFileSync(join(cacheDir, `${div.code}.csv`), got.text, "utf8");
      packs.push({
        code: div.code,
        rows: parseFdoukRows(got.text, div.code),
        oddsCols: counted.odds_columns_ignored,
        url: got.url,
      });
    }
  }

  const rows = packs.flatMap((p) => p.rows);
  const leagues = packs.filter((p) => p.rows.length > 0).map((p) => p.code);
  const oddsCols = packs.reduce((n, p) => n + p.oddsCols, 0);
  const marketComplete = rows.filter((r) => r.b365h != null && r.b365d != null && r.b365a != null);

  if (!rows.length) {
    return emptyLane({
      source_id: "football-data-co-uk",
      url,
      status: http === 403 ? "BLOCKED" : http === 429 ? "RATE_LIMITED" : lastError ? "NETWORK_ERROR" : "NO_DATA",
      http_status: http || null,
      retries,
      reason: lastError ?? "NO_ROWS",
      reason_it:
        http === 403
          ? "football-data.co.uk ha restituito HTTP 403. Il CSV resta CACHE_ONLY se presente in locale. Nessun dato inventato."
          : `football-data.co.uk non disponibile (HTTP ${http || "?"}).`,
    });
  }

  const records: AcquisitionRecord[] = [
    {
      source_id: "football-data-co-uk",
      kind: "results",
      feature_key: "fdouk_result_rows",
      value: rows.length,
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
      reason_it: `${rows.length} righe risultato (${leagues.join(", ")}). Quote ignorate per il modello (${oddsCols} colonne MARKET). DATE_ONLY, non exact.`,
    },
    {
      source_id: "football-data-co-uk",
      kind: "market",
      feature_key: "fdouk_market_1x2_complete",
      value: marketComplete.length,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "date_only",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "football_data_co_uk_b365_market_only",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `${marketComplete.length} quote 1X2 Bet365 complete. Layer mercato/UI, mai modello indipendente.`,
    },
  ];

  let quotesStored = 0;
  for (const ev of input.labEvents ?? []) {
    const hits = marketComplete.filter((r) => matchEventPair(ev.home, ev.away, r.home, r.away).matched);
    if (hits.length !== 1) continue;
    const row = hits[0]!;
    records.push({
      source_id: "football-data-co-uk",
      kind: "market",
      feature_key: "fdouk_event_market_1x2",
      value: row.b365h,
      event_id: ev.event_id,
      home: row.home,
      away: row.away,
      kickoff_iso: ev.kickoff_utc ?? null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "date_only",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "football_data_co_uk_b365_market_only",
      source_url: url,
      identity_status: "EXACT",
      reason_it: "Quota 1X2 Bet365 da CSV (DATE_ONLY). Solo confronto UI, non entra nel modello.",
    });
    if (input.persistLabB && input.labBRoot && row.b365h && row.b365d && row.b365a) {
      const persisted = persistCompareOnlyQuotes({
        labBRoot: input.labBRoot,
        eventId: ev.event_id,
        bookmaker: "bet365",
        source: "football-data-co-uk",
        home: row.b365h,
        draw: row.b365d,
        away: row.b365a,
        collectedAt: input.nowIso,
      });
      quotesStored += persisted.stored;
    }
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "football-data-co-uk",
      name: "football-data.co.uk",
      licenseClass: "dataset",
    });
  }

  return {
    source_id: "football-data-co-uk",
    ok: rows.length > 0,
    fetched: true,
    status: rows.length > 0 ? "OK" : "NO_DATA",
    http_status: http,
    url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `rows=${rows.length}; odds_columns_ignored=${oddsCols}; leagues=${leagues.join(",")}; market_1x2=${marketComplete.length}`,
    reason_it: `football-data.co.uk: ${rows.length} risultati DATE_ONLY (${leagues.join(", ")}). Le quote restano layer di mercato.`,
    retries,
    cache_path: join(cacheDir, `${leagues[0] ?? "E0"}.csv`),
    neon,
    coverage: { leagues, sports: ["football"], market_quotes: quotesStored || marketComplete.length },
  };
}
