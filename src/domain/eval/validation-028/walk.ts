import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import {
  emptyTeamState,
  stageInputFromState,
  teamKey,
  updateAfterReveal,
  type TeamState027,
} from "@/domain/eval/breakthrough-027/features";
import type { Exp028Config, Partition028 } from "@/domain/eval/validation-028/types";
import { fitSoftmax, logisticFeatures, modelProbs028, type SoftmaxWeights } from "@/domain/eval/validation-028/models";
import { actualIdx } from "@/domain/eval/validation-028/metrics";
import { corpusPartition } from "@/domain/eval/validation-028/partition";
import { marketDevig } from "@/domain/eval/turnaround-025/models";
import { computeOverround } from "@/domain/odds/math";

export type WalkRow028 = {
  event: StrictCandidate027;
  partition: Partition028;
  year: number;
  week: string;
  actual: 0 | 1 | 2;
  market: [number, number, number];
  overround: number;
  probs: Record<string, [number, number, number] | null>;
  eloDiff: number;
  formSample: number;
  asOf: string;
};

export function walkFrozen028(input: {
  events: readonly StrictCandidate027[];
  cfg: Exp028Config;
}): { rows: WalkRow028[]; logistic: SoftmaxWeights | null; logisticTrainN: number } {
  const teams = new Map<string, TeamState027>();
  let h = 0;
  let d = 0;
  let a = 0;
  const trainX: number[][] = [];
  const trainY: (0 | 1 | 2)[] = [];
  let logistic: SoftmaxWeights | null = null;
  let fitted = false;
  const rows: WalkRow028[] = [];

  for (const event of input.events) {
    const asOfMs = Date.parse(event.as_of);
    const kickMs = Date.parse(event.kickoff);
    if (!(asOfMs < kickMs)) throw new BlindLeakageError("quote not < kickoff");
    const part = corpusPartition(event.kickoff, input.cfg);
    if (part !== "TRAIN" && !fitted) {
      logistic = fitSoftmax({
        X: trainX,
        y: trainY,
        iters: input.cfg.logistic_iters,
        lr: input.cfg.logistic_lr,
        seed: input.cfg.logistic_seed,
      });
      fitted = true;
    }

    const hk = teamKey(event.home);
    const ak = teamKey(event.away);
    const home = teams.get(hk) ?? emptyTeamState();
    const away = teams.get(ak) ?? emptyTeamState();
    if (!teams.has(hk)) teams.set(hk, home);
    if (!teams.has(ak)) teams.set(ak, away);
    const prior = h + d + a;
    const freq: [number, number, number] =
      prior === 0 ? [1 / 3, 1 / 3, 1 / 3] : [h / prior, d / prior, a / prior];
    const stage = stageInputFromState({ event, home, away, freq });
    const market = marketDevig(stage.marketOdds!);
    if (!market) continue;
    const overround = computeOverround([event.home_odds, event.draw_odds, event.away_odds]).overround;
    if (part === "TRAIN") {
      trainX.push(logisticFeatures(stage, market));
      trainY.push(actualIdx(event.ft_home, event.ft_away));
    }

    const decisionPayload: Record<string, unknown> = {
      event_id: event.event_id,
      as_of: event.as_of,
      odds: { home: event.home_odds, draw: event.draw_odds, away: event.away_odds },
    };
    if ("ft_home" in decisionPayload || "clv" in decisionPayload || "outcome" in decisionPayload) {
      throw new BlindLeakageError("forbidden field in DecisionContext");
    }

    const ids = [...input.cfg.models, ...input.cfg.ablation];
    const probs: Record<string, [number, number, number] | null> = {};
    for (const id of ids) {
      probs[id] = modelProbs028({
        id: id as never,
        stage,
        logistic: fitted ? logistic : null,
      });
    }

    const actual = actualIdx(event.ft_home, event.ft_away);
    const y0 = Date.UTC(Number(event.kickoff.slice(0, 4)), 0, 1);
    const weekN = Math.floor((kickMs - y0) / (7 * 86_400_000));
    rows.push({
      event,
      partition: part,
      year: Number(event.kickoff.slice(0, 4)),
      week: `${event.kickoff.slice(0, 4)}-W${weekN}`,
      actual,
      market,
      overround,
      probs,
      eloDiff: stage.eloDiff ?? 0,
      formSample: stage.formSample,
      asOf: event.as_of,
    });

    updateAfterReveal({
      home,
      away,
      ftHome: event.ft_home,
      ftAway: event.ft_away,
      ts: kickMs,
    });
    if (actual === 0) h += 1;
    else if (actual === 1) d += 1;
    else a += 1;
  }

  if (!fitted) {
    logistic = fitSoftmax({
      X: trainX,
      y: trainY,
      iters: input.cfg.logistic_iters,
      lr: input.cfg.logistic_lr,
      seed: input.cfg.logistic_seed,
    });
  }

  return { rows, logistic, logisticTrainN: trainX.length };
}
