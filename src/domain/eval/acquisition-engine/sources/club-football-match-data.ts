/**
 * Club-Football-Match-Data — CACHE_ONLY research corpus.
 * Uses the local clone when present. Never invents rows. Odds columns stay MARKET.
 */
import { existsSync, readFileSync } from "node:fs";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { bindClubFootballEvent } from "@/domain/eval/data-intelligence/research/club-football-bind";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

const ODDS_HINT = /odd|over25|under25|handi/i;

export function countClubFootballRows(csvText: string): {
  rows: number;
  odds_columns_ignored: number;
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: 0, odds_columns_ignored: 0 };
  const header = lines[0]!.split(",");
  const odds_columns_ignored = header.filter((h) => ODDS_HINT.test(h)).length;
  return { rows: lines.length - 1, odds_columns_ignored };
}

export async function runClubFootballMatchDataLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  csvText?: string;
  csvPath?: string;
  labEvents?: AcquisitionCycleInput["labEvents"];
}): Promise<SourceLaneResult> {
  const path = input.csvPath ?? CLUB_FOOTBALL_MATCHES_CSV;
  const filePresent = input.csvText != null || existsSync(path);
  if (!filePresent) {
    return emptyLane({
      source_id: "club-football-match-data",
      url: input.url,
      status: "NO_DATA",
      reason: "CACHE_MISS — local Club-Football-Match-Data clone not present",
      reason_it:
        "Club-Football-Match-Data e un corpus locale (CACHE_ONLY). Il clone non e presente. Nessuna riga inventata.",
    });
  }

  const csvText = input.csvText ?? readFileSync(path, "utf8");
  const counted = countClubFootballRows(csvText);
  if (counted.rows <= 0) {
    return emptyLane({
      source_id: "club-football-match-data",
      url: input.url,
      status: "PARSE_ERROR",
      reason: "EMPTY_CSV",
      reason_it: "Il CSV Club-Football-Match-Data e vuoto. Nessun risultato inventato.",
    });
  }

  const records: AcquisitionRecord[] = [
    {
      source_id: "club-football-match-data",
      kind: "research_dataset",
      feature_key: "club_football_rows_parsed",
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
      extraction_method: "club_football_local_csv",
      source_url: input.url,
      identity_status: "UNBOUND",
      reason_it: `${counted.rows} righe locali. DATE_ONLY. ${counted.odds_columns_ignored} colonne quote ignorate (layer mercato).`,
    },
  ];

  for (const ev of input.labEvents ?? []) {
    const bind = bindClubFootballEvent({
      home: ev.home,
      away: ev.away,
      kickoffIso: ev.kickoff_utc ?? input.nowIso,
      csvText,
    });
    if (bind.status === "MISSING_FILE" || bind.status === "NO_EVENT") continue;
    if (bind.home_gf_l5 == null && bind.away_gf_l5 == null) continue;
    records.push({
      source_id: "club-football-match-data",
      kind: "research_dataset",
      feature_key: "club_football_prior_n",
      value: bind.prior_n,
      event_id: ev.event_id,
      home: ev.home,
      away: ev.away,
      kickoff_iso: ev.kickoff_utc ?? null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "date_only",
      feature_status: "NOT_ELIGIBLE",
      enters_independent_model: false,
      extraction_method: "club_football_local_csv",
      source_url: input.url,
      identity_status: "UNBOUND",
      reason_it: `Priors Club-Football (n=${bind.prior_n}). DATE_ONLY; quote ignorate; non entra nel modello.`,
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "club-football-match-data",
      name: "Club-Football-Match-Data",
      licenseClass: "dataset",
    });
  }

  return {
    source_id: "club-football-match-data",
    ok: true,
    fetched: false,
    status: "OK",
    http_status: null,
    url: input.url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `rows=${counted.rows}; odds_columns_ignored=${counted.odds_columns_ignored}; CACHE_ONLY`,
    reason_it: `Club-Football-Match-Data locale: ${counted.rows} righe. DATE_ONLY. Quote escluse dal modello.`,
    retries: 0,
    cache_path: input.csvText ? null : path,
    neon,
    coverage: { leagues: [], sports: ["football"] },
  };
}
