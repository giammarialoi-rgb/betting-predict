/**
 * Per-event research/scrape status — append-only, never invents available_at.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { coerceAvailableAtToIso } from "@/lib/available-at";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type ResearchPhase =
  | "QUEUED"
  | "FETCH"
  | "RAW"
  | "PARSE"
  | "OBSERVED"
  | "BLOCKED"
  | "DENIED"
  | "UNAVAILABLE"
  | "OK"
  | "MISSING_ADAPTER"
  | "POST_KICKOFF";

export type ResearchStatusRow = {
  event_id: string;
  source_id: string;
  phase: ResearchPhase;
  ok: boolean;
  fetched: boolean;
  fetched_at: string | null;
  available_at: string | null;
  reason: string | null;
  enters_independent_model: false;
  raw_ref: string | null;
  cycle_number: number | null;
  at: string;
  /** Optional lineage fields (Phase 3D). */
  url?: string | null;
  http_status?: number | null;
  parser_status?: string | null;
  fields_extracted?: string[] | null;
  adapter_kind?: string | null;
  observed_at?: string | null;
};

export function researchStatusPath(root = permanentRoot044()): string {
  return join(root, "research-status.jsonl");
}

export function appendResearchStatus(
  row: ResearchStatusRow,
  root = permanentRoot044(),
): void {
  mkdirSync(root, { recursive: true });
  const sanitized: ResearchStatusRow = {
    ...row,
    available_at: coerceAvailableAtToIso(row.available_at),
  };
  appendFileSync(researchStatusPath(root), `${JSON.stringify(sanitized)}\n`, "utf8");
}

export function loadResearchStatusForEvent(
  eventId: string,
  root = permanentRoot044(),
  limit = 80,
): ResearchStatusRow[] {
  const p = researchStatusPath(root);
  if (!existsSync(p)) return [];
  const out: ResearchStatusRow[] = [];
  const lines = readFileSync(p, "utf8").split(/\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const row = JSON.parse(lines[i]!) as ResearchStatusRow;
      if (row.event_id === eventId) {
        out.push(row);
        if (out.length >= limit) break;
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Latest status per source for an event. */
export function latestResearchBySource(
  eventId: string,
  root = permanentRoot044(),
): ResearchStatusRow[] {
  const rows = loadResearchStatusForEvent(eventId, root, 400);
  const by = new Map<string, ResearchStatusRow>();
  for (const r of rows) {
    if (!by.has(r.source_id)) by.set(r.source_id, r);
  }
  return [...by.values()];
}

export function writeResearchCycleSummary(
  summary: Record<string, unknown>,
  root = permanentRoot044(),
): void {
  const dir = join(root, "manifests");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "research-cycle-summary.json"), JSON.stringify(summary, null, 2));
}
