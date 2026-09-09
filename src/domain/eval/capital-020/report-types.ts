import type {
  AnnualCapitalRow,
  DecisionRecord020,
  ErrorClass020,
  GithubRepoAudit,
  ModelCompareRow,
  SourceLineage,
  SportId020,
} from "@/domain/eval/capital-020/types";

export type Task020Report = {
  experiment_id: string;
  task: "020";
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: string;
  verdict: "NO_DEMONSTRATED_EDGE";
  dataset: {
    events_normalized: number;
    events_matched_club: number;
    club_index: number;
    quotes: number;
    bookmakers: number;
    exact_timestamp: number;
    date_only: number;
    strict_usable: number;
    observed_markets: string[];
    competitions: string[];
  };
  lineage: {
    rows: SourceLineage[];
    upstream_clusters: string[];
  };
  github_audits: readonly GithubRepoAudit[];
  sport_adapters: Record<SportId020, "OBSERVED" | "EMPTY">;
  model_ready: Record<string, boolean>;
  catalogued_unobserved: string[];
  annual: AnnualCapitalRow[];
  model_rows: ModelCompareRow[];
  decisions: DecisionRecord020[];
  error_freq: Record<ErrorClass020, number>;
  policies: {
    flat: "unused";
    fractional_kelly: "unused";
    risk_capped_kelly: "unused";
    actuarial_v1: "unused";
    masaniello_challenger: "unused";
    best: null;
  };
  multiple_testing: {
    alpha: number;
    tests: number;
    bonferroni: number;
    any_significant: false;
  };
  counts: { decisions: number; bets: number; no_bet: number };
  sample_assessment: string | null;
  live_football_data_co_uk: number | null;
  better_than_date_only: {
    found_format: boolean;
    format: string;
    ingested_for_capital: boolean;
    reason: string;
  };
};
