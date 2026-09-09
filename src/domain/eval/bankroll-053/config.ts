import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export { permanentRoot044 as labBStore053, labAStore044 };

export const VIRTUAL_BANKROLL_INITIAL_053 = 1000;
export const MODEL_ACTIVE_053 = "MODEL_v2_DECISION_ENGINE";

export type StakeStrategy053 = "FLAT" | "PERCENT_BANKROLL" | "KELLY_FRACTIONAL";

export const STRATEGIES_053: StakeStrategy053[] = ["FLAT", "PERCENT_BANKROLL", "KELLY_FRACTIONAL"];

export function exp053Path(): string {
  return join(process.cwd(), "experiments", "exp_053_massive_data_virtual_bankroll.json");
}

export function experimentSha053(): string {
  return createHash("sha256").update(readFileSync(exp053Path())).digest("hex");
}

export function loadExp053Config() {
  const parsed = JSON.parse(readFileSync(exp053Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_054: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    seed_events_are_not_a_cap: true;
    no_artificial_event_cap: true;
    virtual_bankroll_initial: number;
    legacy_dataset_sha256: string;
    baseline: string;
  };
  if (parsed.experiment_id !== "exp_053_massive_data_virtual_bankroll") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    parsed.winner !== null ||
    parsed.auto_promotion !== false ||
    parsed.real_money !== false ||
    parsed.open_task_054 !== false ||
    parsed.modify_lab_a !== false ||
    parsed.modify_frozen_031 !== false ||
    parsed.synthetic_data !== false ||
    parsed.capital_gate !== false ||
    parsed.seed_events_are_not_a_cap !== true ||
    parsed.no_artificial_event_cap !== true ||
    parsed.virtual_bankroll_initial !== 1000 ||
    parsed.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    parsed.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 053 flags violated");
  }
  return parsed;
}

export function artifactsRoot053(): string {
  return join(process.cwd(), "artifacts", "task-053");
}

export function writeArtifact053(name: string, payload: unknown): void {
  const root = artifactsRoot053();
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export function bankrollDir053(root = permanentRoot044()): string {
  return join(root, "virtual-bankroll");
}

export function ensureBankrollDirs053(root = permanentRoot044()): void {
  mkdirSync(bankrollDir053(root), { recursive: true });
}

export function bankrollStatePath053(root = permanentRoot044()): string {
  return join(bankrollDir053(root), "bankroll-state.json");
}

export function bankrollLedgerPath053(root = permanentRoot044()): string {
  return join(bankrollDir053(root), "ledger.jsonl");
}

export type StrategyState053 = {
  strategy: StakeStrategy053;
  bankroll: number;
  peak: number;
  max_drawdown: number;
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  profit: number;
};

export type VirtualBankrollState053 = {
  initial: number;
  strategies: Record<StakeStrategy053, StrategyState053>;
  capital: "VIRTUAL_ONLY";
  real_money: false;
  auto_promotion: false;
  qualification: "SIMULATION_ONLY_NOT_SCIENTIFICALLY_QUALIFIED";
  model_edge: "UNKNOWN";
  updated_at: string | null;
};

export function defaultStrategyState053(strategy: StakeStrategy053): StrategyState053 {
  return {
    strategy,
    bankroll: VIRTUAL_BANKROLL_INITIAL_053,
    peak: VIRTUAL_BANKROLL_INITIAL_053,
    max_drawdown: 0,
    bets: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    profit: 0,
  };
}

export function defaultBankrollState053(): VirtualBankrollState053 {
  return {
    initial: VIRTUAL_BANKROLL_INITIAL_053,
    strategies: {
      FLAT: defaultStrategyState053("FLAT"),
      PERCENT_BANKROLL: defaultStrategyState053("PERCENT_BANKROLL"),
      KELLY_FRACTIONAL: defaultStrategyState053("KELLY_FRACTIONAL"),
    },
    capital: "VIRTUAL_ONLY",
    real_money: false,
    auto_promotion: false,
    qualification: "SIMULATION_ONLY_NOT_SCIENTIFICALLY_QUALIFIED",
    model_edge: "UNKNOWN",
    updated_at: null,
  };
}

export function loadBankrollState053(root = permanentRoot044()): VirtualBankrollState053 {
  ensureBankrollDirs053(root);
  const p = bankrollStatePath053(root);
  if (!existsSync(p)) {
    const d = defaultBankrollState053();
    saveBankrollState053(root, d);
    return d;
  }
  const raw = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  return { ...defaultBankrollState053(), ...JSON.parse(raw) };
}

export function saveBankrollState053(root: string, state: VirtualBankrollState053): void {
  ensureBankrollDirs053(root);
  writeFileSync(bankrollStatePath053(root), JSON.stringify(state, null, 2));
}
