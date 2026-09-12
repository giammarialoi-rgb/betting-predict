/**
 * Typed research observations. available_at stays null unless demonstrated.
 * Scrape observations never enter the independent MODEL.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { coerceAvailableAt } from "@/lib/available-at";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

function sanitizeObservationClock(row: ResearchObservation): ResearchObservation {
  const coerced = coerceAvailableAt(row.available_at);
  if (!coerced.unparseable && coerced.iso === row.available_at) return row;
  if (!coerced.unparseable && coerced.iso === null && row.available_at == null) return row;
  return {
    ...row,
    available_at: coerced.iso,
    enters_independent_model: coerced.unparseable ? false : row.enters_independent_model,
    status: coerced.unparseable && row.status === "REAL" ? "INVALID" : row.status,
  };
}

export type ResearchObservationKind =
  | "HISTORICAL_PRIOR"
  | "EVENT_RESEARCH"
  | "DERIVED"
  | "CONTEXT"
  | "MARKET";

export type ResearchObservation = {
  event_id: string;
  feature_key: string;
  value: number | string | null;
  source: string;
  source_url: string | null;
  observed_at: string;
  available_at: string | null;
  extraction_method: string;
  confidence: number | null;
  status: "REAL" | "CONTEXT" | "MISSING" | "INVALID" | "EXCLUDED_TEMPORALLY";
  kind?: ResearchObservationKind;
  derived_from?: string[];
  /** Real provider event id when observed — never invented. */
  source_event_id?: string | null;
  /** Canonical BetMind event this observation was derived for. */
  target_event_id?: string | null;
  /** True only when the independent PI engine already consumes this key. */
  enters_independent_model: boolean;
  content_hash?: string | null;
};

export function researchObservationsPath(root = permanentRoot044()): string {
  return join(root, "research-observations.jsonl");
}

export function observationDedupeKey(row: Pick<ResearchObservation, "event_id" | "source" | "feature_key" | "observed_at" | "available_at">): string {
  return `${row.event_id}|${row.source}|${row.feature_key}|${row.available_at ?? ""}|${row.observed_at}`;
}

const writtenThisProcess = new Set<string>();

/** Append unless the same logical observation was already persisted this process. */
export function appendResearchObservation(row: ResearchObservation, root = permanentRoot044()): boolean {
  const sanitized = sanitizeObservationClock(row);
  const key = `${sanitized.event_id}|${sanitized.source}|${sanitized.feature_key}|${sanitized.available_at ?? ""}`;
  if (writtenThisProcess.has(key)) return false;
  writtenThisProcess.add(key);
  mkdirSync(root, { recursive: true });
  appendFileSync(researchObservationsPath(root), `${JSON.stringify(sanitized)}\n`, "utf8");
  return true;
}

export function loadResearchObservationsForEvent(
  eventId: string,
  root = permanentRoot044(),
  limit = 200,
): ResearchObservation[] {
  const p = researchObservationsPath(root);
  if (!existsSync(p)) return [];
  const out: ResearchObservation[] = [];
  const lines = readFileSync(p, "utf8").split(/\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const row = JSON.parse(lines[i]!) as ResearchObservation;
      if (row.event_id === eventId) {
        out.push(sanitizeObservationClock(row));
        if (out.length >= limit) break;
      }
    } catch {
      /* skip */
    }
  }
  return out;
}
