/**
 * Challenger registry — shadow comparison only.
 * NEVER auto-promotes. NEVER invents edge. NEVER mutates LOCK/Lab A.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { MODEL_ACTIVE_053 } from "@/domain/eval/bankroll-053/config";

export type Challenger053 = {
  model_id: string;
  role: "CHAMPION" | "CHALLENGER";
  status: "OBSERVATION_ONLY" | "HOLD";
  auto_promotion: false;
  real_money: false;
  settled_required_for_edge: 100;
  note: string;
};

export function writeChallengerRegistry053(root = permanentRoot044()): Challenger053[] {
  const rows: Challenger053[] = [
    {
      model_id: MODEL_ACTIVE_053,
      role: "CHAMPION",
      status: "OBSERVATION_ONLY",
      auto_promotion: false,
      real_money: false,
      settled_required_for_edge: 100,
      note: "MARKET_BASELINE decision layer — MODEL_EDGE UNKNOWN until SETTLED>=100 + stats gates",
    },
    {
      model_id: "INDEPENDENT_POISSON_v1",
      role: "CHALLENGER",
      status: "OBSERVATION_ONLY",
      auto_promotion: false,
      real_money: false,
      settled_required_for_edge: 100,
      note: "Independent no-odds Poisson — shadow/challenger; no auto-promotion",
    },
    {
      model_id: "MODEL_V3_WHY_SHADOW",
      role: "CHALLENGER",
      status: "OBSERVATION_ONLY",
      auto_promotion: false,
      real_money: false,
      settled_required_for_edge: 100,
      note: "Shadow WHY/machine-readable labels only — does not invent BET from market mirror",
    },
  ];
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(
    join(root, "manifests", "challenger-registry-053.json"),
    JSON.stringify({ at: new Date().toISOString(), models: rows, open_task_054: false }, null, 2),
  );
  return rows;
}

export function loadChallengerRegistry053(root = permanentRoot044()): Challenger053[] {
  // Always rewrite to keep INDEPENDENT_POISSON_v1 present (idempotent, no auto-promotion)
  return writeChallengerRegistry053(root);
}
