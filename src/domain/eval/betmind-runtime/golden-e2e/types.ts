import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

export type SourceRuntimeStatus = "WORKING" | "PARTIAL" | "BLOCKED" | "FAILED" | "UNAVAILABLE";

export type SourceAuditRow = {
  source_id: string;
  status: SourceRuntimeStatus;
  http_status: number | null;
  extractable_fields: string[];
  reason: string;
  key: "KEY_PRESENT" | "KEY_MISSING" | "NOT_REQUIRED";
  probed: boolean;
};

export type GoldenEventPick = {
  event: PermanentEvent044;
  source: string;
  finished: boolean;
  live: boolean;
  score: { home: number; away: number } | null;
  score_source: string | null;
  discovery_probes: Array<{ source: string; url: string; status: number; parsed: number }>;
};

export type GateResult = {
  name: string;
  passed: boolean;
  reason: string;
};

export type PredictionOutcome =
  | {
      kind: "PREDICTION";
      prediction_id: string;
      event_id: string;
      model_version: string;
      market: string;
      selection: string | null;
      probs: Record<string, number>;
      fair_odds: Record<string, number> | null;
      available_odds: Record<string, number> | null;
      edge: number | null;
      confidence: number | null;
      gate_results: GateResult[];
      evidence_refs: string[];
      dossier_version: string | null;
    }
  | {
      kind: "NO_PREDICTION";
      event_id: string;
      reason: string;
      missing: string[];
      failed_gates: string[];
      gate_results: GateResult[];
      dossier_version: string | null;
    };

export type ChecklistStep = {
  step: string;
  ok: boolean;
  evidence: string;
  count?: number | null;
};

export type GoldenE2EReport = {
  at: string;
  neon_in_use: false;
  neon_status_it: "NEON NON UTILIZZATO";
  blob_credentials: "KEY_PRESENT" | "KEY_MISSING";
  remote_backend: "vercel_blob" | "memory" | "none";
  golden: {
    event_id: string;
    home: string;
    away: string;
    competition: string;
    kickoff_utc: string | null;
    sport: string;
    source: string;
    status: string;
  } | null;
  counts: {
    events: number;
    research_jobs: number;
    sources_queried: number;
    sources_working: number;
    observations: number;
    dossiers_local: number;
    dossiers_remote: number | null;
    brain_cycles: number;
    predictions: number;
    no_predictions: number;
    live_updates: number;
    settlements: number;
    learning_records: number;
  };
  source_audit: SourceAuditRow[];
  prediction: PredictionOutcome | null;
  live: { available: boolean; reason: string } | null;
  settlement: { available: boolean; result: string | null; reason: string } | null;
  learning: { written: boolean; reason: string } | null;
  mirror: {
    local_verified: boolean;
    remote_verified: boolean;
    repaired: boolean;
    reason?: string;
  };
  checklist: ChecklistStep[];
  errors: Array<{ error: string; cause: string; evidence: string; remediation: string }>;
};
