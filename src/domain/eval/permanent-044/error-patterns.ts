import { createHash } from "node:crypto";
import { join } from "node:path";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";

export type ErrorPattern044 = {
  pattern: string;
  sample_size: number;
  frequency: number | null;
  loss: null;
  confidence: number;
  statistical_support: "INSUFFICIENT" | "WEAK" | "MODERATE";
  candidate_action: string;
  created_at: string;
};

/** Aggregate autopsy hypotheses — never conclude on tiny samples. */
export function mineErrorPatterns044(store: Store044, nowIso: string): ErrorPattern044[] {
  const counts = new Map<string, number>();
  for (const a of store.autopsies) {
    const k = a.error_type ?? a.cause_hypotheses[0]?.hypothesis ?? "UNKNOWN";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = store.autopsies.length;
  const out: ErrorPattern044[] = [];
  for (const [pattern, n] of counts) {
    const support: ErrorPattern044["statistical_support"] =
      n < 20 ? "INSUFFICIENT" : n < 50 ? "WEAK" : "MODERATE";
    const rec: ErrorPattern044 = {
      pattern,
      sample_size: n,
      frequency: total > 0 ? n / total : null,
      loss: null,
      confidence: support === "INSUFFICIENT" ? 0.1 : support === "WEAK" ? 0.35 : 0.55,
      statistical_support: support,
      candidate_action: support === "INSUFFICIENT" ? "ACCUMULATE_MORE" : "REVIEW_ONLY_NO_AUTO_PROMOTE",
      created_at: nowIso,
    };
    out.push(rec);
    appendJsonl044(join(store.root, "error-patterns.jsonl"), {
      ...rec,
      pattern_id: createHash("sha256").update(`${pattern}|${nowIso}`).digest("hex").slice(0, 16),
    });
  }
  if (!out.length) {
    const empty: ErrorPattern044 = {
      pattern: "NO_AUTOPSIES_YET",
      sample_size: 0,
      frequency: null,
      loss: null,
      confidence: 0,
      statistical_support: "INSUFFICIENT",
      candidate_action: "ACCUMULATE_SETTLEMENTS",
      created_at: nowIso,
    };
    appendJsonl044(join(store.root, "error-patterns.jsonl"), empty);
    out.push(empty);
  }
  return out;
}
