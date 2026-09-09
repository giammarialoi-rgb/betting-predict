import { CLUSTERS_037 } from "@/domain/eval/harvest-037/catalog";
import type { RepoHarvest037 } from "@/domain/eval/harvest-037/types";

export type Lake037 = {
  clusters: { id: string; repos: string[]; role_mix: string[]; events_est: number; classification: string }[];
  datasets: number;
  repositories_ok: number;
  repositories_missing: number;
  strict_events: 0;
  research_events: number;
  date_only_events: number;
  reference_events: number;
  parser_only: number;
  dataset_not_present: number;
};

export function buildLake037(harvest: readonly RepoHarvest037[]): Lake037 {
  const clusters = CLUSTERS_037.filter((c) => c !== "task-031-base").map((id) => {
    const repos = harvest.filter((h) => h.cluster === id);
    return {
      id,
      repos: repos.map((r) => r.repository),
      role_mix: [...new Set(repos.map((r) => r.role))],
      events_est: repos.reduce((a, r) => a + r.events_est, 0),
      classification: repos[0]?.classification ?? "UNKNOWN",
    };
  });
  return {
    clusters: [
      ...clusters,
      {
        id: "task-031-base",
        repos: ["audit/external/task-027/strict-candidates.csv"],
        role_mix: ["RAW"],
        events_est: 10499,
        classification: "STRICT (FROZEN LEGACY — not counted as 037 new STRICT)",
      },
    ],
    datasets: harvest.filter((h) => h.exists).length,
    repositories_ok: harvest.filter((h) => h.exists).length,
    repositories_missing: harvest.filter((h) => !h.exists).length,
    strict_events: 0,
    research_events: harvest.filter((h) => h.classification === "RESEARCH_TEMPORAL").reduce((a, h) => a + h.events_est, 0),
    date_only_events: harvest.filter((h) => h.classification === "DATE_ONLY").reduce((a, h) => a + h.events_est, 0),
    reference_events: 10499,
    parser_only: harvest.filter((h) => h.classification === "PARSER_NO_DATA").length,
    dataset_not_present: harvest.filter((h) => h.classification === "DATASET_NOT_PRESENT" || h.classification === "NOT_FOUND").length,
  };
}

export const FEATURES_037 = [
  { id: "ELO_ASOF", status: "RESEARCH_ONLY", why: "no verified as-of clock on GitHub harvest" },
  { id: "FORM_ASOF", status: "RESEARCH_ONLY", why: "ivanzou form is not temporally proven" },
  { id: "HISTORY_ASOF", status: "RESEARCH_ONLY", why: "DATE_ONLY results only" },
  { id: "SCHEDULE_ASOF", status: "RESEARCH_ONLY", why: "kickoff often naive/date-only" },
  { id: "XG_ASOF", status: "RESEARCH_ONLY", why: "soccer-dataset xg sample not as-of" },
  { id: "PLAYER_ASOF", status: "RESEARCH_ONLY", why: "no injury/player clock" },
  { id: "INJURY_ASOF", status: "RESEARCH_ONLY", why: "absent" },
  { id: "MARKET_ASOF", status: "RESEARCH_ONLY", why: "open/close/averages, not publish time" },
  { id: "MOVEMENT_ASOF", status: "RESEARCH_ONLY", why: "open vs close labels ≠ two timed snapshots" },
] as const;

export const SINGLE_MISSING_RESOURCE_037 =
  "Per passare da 0 a ≥100 STRICT manca un archivio calcio pubblicamente scaricabile (senza login) con timestamp di pubblicazione della quota (es. Betfair Historic Soccer BASIC/PRO pt/publishedTime, o last_update bookmaker ISO) + kickoff UTC esatto + FT, su ≥100 eventi MATCH_EXACT. Su GitHub ci sono parser, 1 sample BASIC (n=1) e corpus DATE_ONLY/OPEN-CLOSE. L'archivio ufficiale Betfair Soccer resta login-gated.";
