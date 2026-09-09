import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Store044 } from "@/domain/eval/permanent-044/store";

export type Pattern047 = {
  pattern: string;
  sample_size: number;
  win_rate: null;
  loss_rate: null;
  effect_size: null;
  confidence: number;
  first_seen: string;
  last_seen: string;
  status: "INSUFFICIENT_N" | "OBSERVATION_ONLY";
};

/** Aggregate autopsy error types — never promote with small n. */
export function aggregatePatterns047(store: Store044, nowIso: string): Pattern047[] {
  const map = new Map<string, { n: number; first: string; last: string }>();
  for (const a of store.autopsies) {
    const key = a.error_type ?? a.cause_hypotheses[0]?.hypothesis ?? "NO_IDENTIFIABLE_CAUSE";
    const prev = map.get(key);
    if (!prev) map.set(key, { n: 1, first: a.created_at, last: a.created_at });
    else {
      prev.n += 1;
      if (a.created_at < prev.first) prev.first = a.created_at;
      if (a.created_at > prev.last) prev.last = a.created_at;
    }
  }
  const out: Pattern047[] = [];
  for (const [pattern, v] of map) {
    out.push({
      pattern,
      sample_size: v.n,
      win_rate: null,
      loss_rate: null,
      effect_size: null,
      confidence: v.n < 20 ? 0.1 : v.n < 50 ? 0.35 : 0.5,
      first_seen: v.first,
      last_seen: v.last,
      status: v.n < 20 ? "INSUFFICIENT_N" : "OBSERVATION_ONLY",
    });
  }
  if (!out.length) {
    out.push({
      pattern: "NO_AUTOPSIES_YET",
      sample_size: 0,
      win_rate: null,
      loss_rate: null,
      effect_size: null,
      confidence: 0,
      first_seen: nowIso,
      last_seen: nowIso,
      status: "INSUFFICIENT_N",
    });
  }
  mkdirSync(join(store.root, "manifests"), { recursive: true });
  writeFileSync(
    join(store.root, "manifests", "patterns-047.json"),
    JSON.stringify({ at: nowIso, patterns: out }, null, 2),
  );
  return out;
}
