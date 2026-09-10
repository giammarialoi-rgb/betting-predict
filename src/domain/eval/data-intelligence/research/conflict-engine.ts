/**
 * Keep conflicting observations. Never invent consensus.
 * Deterministic primary: FEATURE_SOURCE_PRIORITY then first-seen.
 */
import { FEATURE_SOURCE_PRIORITY } from "@/domain/eval/data-intelligence/research/data-priority";

export type ConflictObservation = {
  feature_key: string;
  source: string;
  value: number | string | null;
};

export type FeatureConflict = {
  field: string;
  status: "CONFLICT";
  values: ConflictObservation[];
  used_source: string | null;
  used_value: number | string | null;
  note_it: string;
};

function primaryFor(key: string): string[] {
  if (key.includes("elo")) return FEATURE_SOURCE_PRIORITY.elo;
  if (key.includes("xg")) return FEATURE_SOURCE_PRIORITY.xg;
  if (key.includes("injur")) return FEATURE_SOURCE_PRIORITY.injuries;
  if (key.includes("lineup")) return FEATURE_SOURCE_PRIORITY.lineups;
  if (key.includes("weather") || key.includes("meteo")) return FEATURE_SOURCE_PRIORITY.weather;
  return FEATURE_SOURCE_PRIORITY.form_results;
}

function norm(v: number | string | null): string {
  if (v == null) return "";
  if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
  return v.toLowerCase().replace(/\s+/g, "");
}

export function detectConflicts(rows: ConflictObservation[]): FeatureConflict[] {
  const byKey = new Map<string, ConflictObservation[]>();
  for (const r of rows) {
    if (r.value == null) continue;
    const arr = byKey.get(r.feature_key) ?? [];
    arr.push(r);
    byKey.set(r.feature_key, arr);
  }
  const out: FeatureConflict[] = [];
  for (const [field, list] of byKey) {
    const uniq = new Map<string, ConflictObservation>();
    for (const r of list) {
      const k = `${r.source}:${norm(r.value)}`;
      if (!uniq.has(k)) uniq.set(k, r);
    }
    const distinct = [...uniq.values()];
    const values = new Set(distinct.map((d) => norm(d.value)));
    if (values.size < 2) continue;
    const order = primaryFor(field);
    const ranked = [...distinct].sort((a, b) => {
      const ia = order.indexOf(a.source);
      const ib = order.indexOf(b.source);
      const sa = ia < 0 ? 99 : ia;
      const sb = ib < 0 ? 99 : ib;
      return sa - sb;
    });
    const used = ranked[0]!;
    out.push({
      field,
      status: "CONFLICT",
      values: distinct,
      used_source: used.source,
      used_value: used.value,
      note_it: `Due o piu fonti hanno riportato valori differenti per ${field}; il motore ha utilizzato ${used.source} secondo la policy di priorita. Nessun consenso inventato.`,
    });
  }
  return out;
}
