/**
 * UI-only React list keys for Control Center.
 * Never mutate event_id / persisted identities — keys are rendering-only.
 */

export type KeyableEventRow052 = {
  event_id: string;
  kickoff_utc?: string | null;
  sport?: string;
  competition?: string;
  markets?: string[];
  selection?: string | null;
  prediction_status?: string;
  status?: string;
  market?: string;
  prediction?: string | null;
  rank?: number;
  decision_id?: string;
  prediction_id?: string;
  pattern?: string;
  phase?: string;
  at?: string;
  kind?: string;
  code?: string;
  message?: string;
  family?: string;
  label?: string;
};

/** Prefer stable secondary fields already present on the row; index is UI-only fallback. */
export function reactListKey052(
  row: KeyableEventRow052,
  index: number,
  prefix = "row",
): string {
  const parts: string[] = [prefix, row.event_id];
  if (row.decision_id) parts.push(`d:${row.decision_id}`);
  if (row.prediction_id) parts.push(`p:${row.prediction_id}`);
  if (row.rank != null) parts.push(`r:${row.rank}`);
  if (row.market) parts.push(`m:${row.market}`);
  if (row.selection) parts.push(`s:${row.selection}`);
  if (row.kickoff_utc) parts.push(`k:${row.kickoff_utc}`);
  if (row.prediction_status) parts.push(`ps:${row.prediction_status}`);
  if (row.status) parts.push(`st:${row.status}`);
  if (row.pattern) parts.push(`pat:${row.pattern}`);
  if (row.phase) parts.push(`ph:${row.phase}`);
  if (row.family) parts.push(`f:${row.family}`);
  if (row.code) parts.push(`c:${row.code}`);
  if (row.at) parts.push(`at:${row.at}`);
  if (row.kind) parts.push(`kind:${row.kind}`);
  // Fallback UI-only: guarantee uniqueness when secondary ids are absent / duplicates remain
  parts.push(`i:${index}`);
  return parts.join("|");
}

/** Deterministic last-wins dedupe by event_id (API/dashboard — does not rewrite Lab B). */
export function dedupeByEventId052<T extends { event_id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.event_id, row);
  return [...map.values()];
}

/** Count how many event_id values appear more than once. */
export function countDuplicateEventIds052<T extends { event_id: string }>(rows: T[]): number {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  return [...counts.values()].filter((n) => n > 1).length;
}

/** Assert React keys in a list are unique (for tests). */
export function assertUniqueReactKeys052(keys: string[]): { ok: boolean; duplicates: string[] } {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const k of keys) {
    if (seen.has(k)) duplicates.push(k);
    else seen.add(k);
  }
  return { ok: duplicates.length === 0, duplicates };
}
