/**
 * Cross-source reconciliation for research rows.
 * Agreement is declared only when two+ sources extracted the same field family.
 */
import type { ResearchLike } from "@/domain/eval/betmind-runtime/explain/source-status";
import { classifyHumanSourceStatus } from "@/domain/eval/betmind-runtime/explain/source-status";

export type ReconciliationStatus =
  | "HIGH_AGREEMENT"
  | "PARTIAL_AGREEMENT"
  | "DISAGREE"
  | "SINGLE_SOURCE"
  | "NO_COMPARISON";

export type FieldReconciliation = {
  field: string;
  label_it: string;
  status: ReconciliationStatus;
  sources: string[];
  note_it: string;
};

const FIELD_FAMILIES: Array<{ field: string; label_it: string; match: RegExp }> = [
  { field: "injuries", label_it: "Infortuni", match: /injur/i },
  { field: "lineup", label_it: "Formazione", match: /lineup|xi/i },
  { field: "xg", label_it: "xG", match: /xg|expected.?goals/i },
  { field: "elo", label_it: "Elo", match: /elo/i },
  { field: "form", label_it: "Forma / risultati", match: /form|prior/i },
];

function extracted(row: ResearchLike): string[] {
  return row.fields_extracted ?? [];
}

export function reconcileResearchRows(rows: ResearchLike[]): FieldReconciliation[] {
  const usable = rows.filter((r) => {
    const s = classifyHumanSourceStatus(r);
    return s === "SUCCESS" || s === "PARTIAL";
  });
  return FIELD_FAMILIES.map((fam) => {
    const sources = usable
      .filter((r) => extracted(r).some((f) => fam.match.test(f)))
      .map((r) => r.source_id);
    const uniq = [...new Set(sources)];
    if (uniq.length === 0) {
      return {
        field: fam.field,
        label_it: fam.label_it,
        status: "NO_COMPARISON" as const,
        sources: [],
        note_it: `Nessuna fonte ha estratto ${fam.label_it} per questa partita.`,
      };
    }
    if (uniq.length === 1) {
      return {
        field: fam.field,
        label_it: fam.label_it,
        status: "SINGLE_SOURCE" as const,
        sources: uniq,
        note_it: `${fam.label_it}: una sola fonte (${uniq[0]}). Nessun confronto incrociato.`,
      };
    }
    const counts = usable
      .filter((r) => uniq.includes(r.source_id) && extracted(r).some((f) => fam.match.test(f)))
      .map((r) => extracted(r).filter((f) => fam.match.test(f)).length);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (min === max) {
      return {
        field: fam.field,
        label_it: fam.label_it,
        status: "HIGH_AGREEMENT" as const,
        sources: uniq,
        note_it: `${fam.label_it}: ${uniq.length} fonti concordano (${uniq.join(", ")}).`,
      };
    }
    return {
      field: fam.field,
      label_it: fam.label_it,
      status: "PARTIAL_AGREEMENT" as const,
      sources: uniq,
      note_it: `${fam.label_it}: accordo parziale tra ${uniq.join(", ")} (conteggi ${min}–${max}).`,
    };
  });
}
