import type { AcquisitionJobStatus } from "@/domain/eval/acquisition-engine/types";
import type { SourceResult, SourceResultStatus } from "@/domain/eval/real-pipeline/types";

const NEVER_ACTIVE: ReadonlySet<SourceResultStatus> = new Set([
  "UNAVAILABLE",
  "BLOCKED",
  "NOT_CONFIGURED",
  "ERROR",
]);

export function envConfigured(name: string | null | undefined): boolean {
  if (!name) return true;
  return Boolean(process.env[name]?.trim());
}

/**
 * Map existing lane / research / HTTP outcomes onto SourceResult.
 * UNAVAILABLE, BLOCKED, NOT_CONFIGURED, ERROR never become ACTIVE.
 */
export function toSourceResultStatus(input: {
  httpStatus?: number | null;
  acquisition?: AcquisitionJobStatus | string | null;
  researchPhase?: string | null;
  extracted?: number;
  configured?: boolean;
  blockedByPolicy?: boolean;
}): SourceResultStatus {
  if (input.configured === false) return "NOT_CONFIGURED";
  if (input.blockedByPolicy) return "BLOCKED";

  const acq = String(input.acquisition ?? "").toUpperCase();
  if (acq === "AUTH_REQUIRED") return "NOT_CONFIGURED";
  if (acq === "BLOCKED" || acq === "RATE_LIMITED") return "BLOCKED";
  if (acq === "NETWORK_ERROR" || acq === "PARSE_ERROR") return "ERROR";
  if (acq === "NO_DATA" || acq === "NO_EVENT" || acq === "SKIPPED") return "UNAVAILABLE";
  if (acq === "PARTIAL") return "PARTIAL";
  if (acq === "OK") {
    return (input.extracted ?? 1) > 0 ? "ACTIVE" : "PARTIAL";
  }

  const phase = String(input.researchPhase ?? "").toUpperCase();
  if (phase === "MISSING_ADAPTER" || phase === "AUTH_REQUIRED") return "NOT_CONFIGURED";
  if (phase === "BLOCKED" || phase === "POLICY_DENIED") return "BLOCKED";
  if (phase === "OK" || phase === "FETCH_OK") {
    return (input.extracted ?? 1) > 0 ? "ACTIVE" : "PARTIAL";
  }
  if (phase === "PARTIAL") return "PARTIAL";
  if (phase === "ERROR" || phase === "FAIL") return "ERROR";

  const http = input.httpStatus ?? null;
  if (http === 401 || http === 403 || http === 429) return "BLOCKED";
  if (http != null && http >= 500) return "ERROR";
  if (http === 0 || http === null) {
    return "UNAVAILABLE";
  }
  if (http === 200) return (input.extracted ?? 0) > 0 ? "ACTIVE" : "PARTIAL";
  if (http >= 400) return "ERROR";
  return "UNAVAILABLE";
}

export function sourceResult(partial: Omit<SourceResult, "enters_independent_model"> & {
  enters_independent_model?: boolean;
}): SourceResult {
  const status = partial.status;
  const entersModel = partial.enters_independent_model === true;
  if (NEVER_ACTIVE.has(status) && entersModel) {
    throw new Error("UNAVAILABLE_MAPPED_TO_ACTIVE");
  }
  return {
    ...partial,
    enters_independent_model: entersModel,
  };
}

export function classifyConfiguredSource(input: {
  source_id: string;
  env_var: string | null;
  role: SourceResult["role"];
  fetched?: boolean;
  http_status?: number | null;
  fields_extracted?: string[];
  records?: number;
  reason?: string;
  acquisition?: string | null;
  researchPhase?: string | null;
  blockedByPolicy?: boolean;
  enters_independent_model?: boolean;
}): SourceResult {
  const configured = envConfigured(input.env_var);
  const status = toSourceResultStatus({
    httpStatus: input.http_status,
    acquisition: input.acquisition,
    researchPhase: input.researchPhase,
    extracted: input.fields_extracted?.length ?? input.records ?? 0,
    configured,
    blockedByPolicy: input.blockedByPolicy,
  });
  return sourceResult({
    source_id: input.source_id,
    status,
    fetched: Boolean(input.fetched),
    http_status: input.http_status ?? null,
    fields_extracted: input.fields_extracted ?? [],
    records: input.records ?? 0,
    reason:
      input.reason ??
      (status === "NOT_CONFIGURED" && input.env_var
        ? `${input.env_var} missing`
        : status),
    configured,
    env_var: input.env_var,
    role: input.role,
    enters_independent_model: input.enters_independent_model === true,
  });
}
