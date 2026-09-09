import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { acquireTask031 } from "@/domain/eval/breakthrough-031/acquire";
import { quotesForEvents } from "@/domain/eval/breakthrough-031/canonical";
import { loadExp031Config } from "@/domain/eval/breakthrough-031/config";
import { freezeDataset031Base, freezeUnion031 } from "@/domain/eval/breakthrough-031/freeze";
import { leakMasanielloProduction, runHostileBattery031 } from "@/domain/eval/breakthrough-031/leakage";
import type {
  AnnualRow031,
  CanonicalEvent031,
  Probe031,
  SourceRow031,
  Verdict031,
} from "@/domain/eval/breakthrough-031/types";
import { FROZEN_028_SHA256_031 } from "@/domain/eval/breakthrough-031/types";
import { runTask030, type Task030Report } from "@/domain/eval/final-edge-lab";

export function verdict031(input: {
  fixture: boolean;
  strictEvents: number;
  modelReady: boolean;
  predictiveGate: boolean;
  huntExhausted: boolean;
}): Verdict031 {
  if (input.fixture) return "INSUFFICIENT_DATA";
  if (input.strictEvents < 100) {
    return input.huntExhausted ? "HARD_DATA_BLOCK" : "INSUFFICIENT_DATA";
  }
  if (input.predictiveGate) return "BREAKTHROUGH_EDGE";
  return "BREAKTHROUGH_NO_EDGE";
}

export function fingerprint031(input: {
  verdict: Verdict031;
  baseSha: string;
  unionSha: string;
  strict: number;
  added: number;
  predictiveGate: boolean;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function yearOfKickoff(iso: string): number {
  return Number(iso.slice(0, 4));
}

function yearFullyCovered(year: number, periodStart: string | null, periodEnd: string | null): boolean {
  if (!periodStart || !periodEnd) return false;
  return periodStart <= `${year}-01-01T00:00:00.000Z` && periodEnd >= `${year}-12-31T00:00:00.000Z`;
}

export function annualFromEvents(input: {
  years: readonly number[];
  events: readonly CanonicalEvent031[];
  periodStart: string | null;
  periodEnd: string | null;
  predictiveGate: boolean;
  fixture: boolean;
}): AnnualRow031[] {
  return input.years.map((year) => {
    const n = input.events.filter((e) => yearOfKickoff(e.kickoff) === year).length;
    const start = 1000;
    if (input.fixture || n === 0) {
      return {
        year,
        strict: n,
        decisions: 0,
        bets: 0,
        start,
        end: null,
        pnl: null,
        roi: null,
        max_dd: null,
        model: null,
        status: "INSUFFICIENT_DATA",
      };
    }
    const status: AnnualRow031["status"] = input.predictiveGate
      ? yearFullyCovered(year, input.periodStart, input.periodEnd)
        ? "VALID"
        : "PARTIAL_DATA"
      : yearFullyCovered(year, input.periodStart, input.periodEnd)
        ? "NO_EDGE"
        : "PARTIAL_DATA";
    return {
      year,
      strict: n,
      decisions: n,
      bets: 0,
      start,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      model: "MARKET_DEVIG",
      status,
    };
  });
}

export type Task031Report = {
  experiment_id: string;
  task: "031";
  dataset_id: "DATASET_031_BASE";
  as_of_policy: "STRICT_AS_OF";
  primary_window: "T-1h";
  baseline: "market_devig";
  frozen_028_sha256: string;
  observed_base_sha256: string;
  union_fingerprint: string;
  added_strict_events: number;
  strict_events: number;
  research_events: number;
  fixture_mode: boolean;
  model_ready: boolean;
  capital_test: boolean;
  predictive_gate: boolean;
  winner: null;
  declared_best: false;
  auto_promotion: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  promotion: "BLOCKED";
  masaniello_production: false;
  verdict: Verdict031;
  period_start: string | null;
  period_end: string | null;
  partitions: Task030Report["partitions"];
  scores: Task030Report["scores"];
  holm: Task030Report["holm"];
  selected_families: Task030Report["selected_families"];
  ci95_delta_brier_all: Task030Report["ci95_delta_brier_all"];
  annual: AnnualRow031[];
  sources: SourceRow031[];
  probes: Probe031[];
  leakage: { id: string; throws: boolean }[];
  holdout_2020_plus: number;
  years_testable: number[];
  years_not_testable: number[];
  fingerprint: string;
  task_030_fingerprint: string;
  task_030_verdict: Task030Report["verdict"];
};

export async function runTask031(input: { skipHeavy?: boolean }): Promise<Task031Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp031Config();
  leakMasanielloProduction(cfg.primary_risk_policy);
  const acq = await acquireTask031({ skipHeavy });
  const base = freezeDataset031Base({ skipHeavy });
  const union = freezeUnion031({ base: base.events, added: [], baseSha: base.sha256 });
  const t030 = await runTask030({ skipHeavy });
  const leakage = runHostileBattery031();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage battery miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  const quotes = quotesForEvents(union.events);
  void quotes;
  const testN = t030.partitions.TEST.events;
  const model_ready =
    !base.fixture &&
    union.events.length >= cfg.strict_event_gate &&
    testN >= 1 &&
    union.events.every((e) => e.match_confidence === "MATCH_EXACT" && e.strict_status === "STRICT");
  const capital_test = model_ready && t030.predictive_gate;
  const verdict = verdict031({
    fixture: base.fixture,
    strictEvents: union.events.length,
    modelReady: model_ready,
    predictiveGate: t030.predictive_gate,
    huntExhausted: acq.hunt_exhausted,
  });
  const annual = annualFromEvents({
    years: cfg.solar_years,
    events: union.events,
    periodStart: base.period_start,
    periodEnd: base.period_end,
    predictiveGate: t030.predictive_gate,
    fixture: base.fixture,
  });
  const holdout_2020_plus = union.events.filter((e) => yearOfKickoff(e.kickoff) >= 2020).length;
  const years_testable = [...new Set(union.events.map((e) => yearOfKickoff(e.kickoff)))].sort((a, b) => a - b);
  const years_not_testable = cfg.solar_years.filter((y) => !years_testable.includes(y));
  const fp = fingerprint031({
    verdict,
    baseSha: base.sha256,
    unionSha: union.fingerprint,
    strict: union.events.length,
    added: union.added_kept,
    predictiveGate: t030.predictive_gate,
  });
  return {
    experiment_id: cfg.experiment_id,
    task: "031",
    dataset_id: "DATASET_031_BASE",
    as_of_policy: "STRICT_AS_OF",
    primary_window: "T-1h",
    baseline: "market_devig",
    frozen_028_sha256: FROZEN_028_SHA256_031,
    observed_base_sha256: base.sha256,
    union_fingerprint: union.fingerprint,
    added_strict_events: union.added_kept,
    strict_events: union.events.length,
    research_events: (acq.five_dollar?.events ?? 0) + (acq.julien?.matches ?? 0),
    fixture_mode: base.fixture,
    model_ready,
    capital_test,
    predictive_gate: t030.predictive_gate,
    winner: null,
    declared_best: false,
    auto_promotion: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    promotion: "BLOCKED",
    masaniello_production: false,
    verdict,
    period_start: base.period_start,
    period_end: base.period_end,
    partitions: t030.partitions,
    scores: t030.scores,
    holm: t030.holm,
    selected_families: t030.selected_families,
    ci95_delta_brier_all: t030.ci95_delta_brier_all,
    annual,
    sources: acq.sources,
    probes: acq.probes,
    leakage,
    holdout_2020_plus,
    years_testable,
    years_not_testable,
    fingerprint: fp,
    task_030_fingerprint: t030.fingerprint,
    task_030_verdict: t030.verdict,
  };
}

export function loadTask031ReportForUi(): Task031Report | null {
  const p = join(process.cwd(), "artifacts", "task-031-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task031Report;
    if (raw.experiment_id === "exp_031_final_data_breakthrough") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask031(): Promise<Task031Report> {
  return loadTask031ReportForUi() ?? runTask031({ skipHeavy: true });
}
