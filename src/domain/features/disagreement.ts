/**
 * Source disagreement — record divergence; do not blind-average.
 */

export type DisagreementKind =
  | "elo"
  | "odds"
  | "injury"
  | "team_status"
  | "entity"
  | "other";

export type SourceDisagreement = {
  kind: DisagreementKind;
  field: string;
  sources: Array<{ source: string; value: string | number | boolean | null }>;
  status: "RECORDED";
  /** Weights intentionally omitted — no invented reliability. */
  note: string;
};

export function recordSourceDisagreement(input: {
  kind: DisagreementKind;
  field: string;
  sources: Array<{ source: string; value: string | number | boolean | null }>;
  note?: string;
}): SourceDisagreement | null {
  const distinct = new Set(
    input.sources.map((s) => JSON.stringify(s.value)),
  );
  if (distinct.size <= 1) return null;
  return {
    kind: input.kind,
    field: input.field,
    sources: input.sources,
    status: "RECORDED",
    note: input.note ?? "divergence recorded without averaging",
  };
}
