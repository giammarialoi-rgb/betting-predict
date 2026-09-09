import type { ScoreCard035 } from "@/domain/eval/breakthrough-035/types";

export function scoreCard035(input: {
  clock: ScoreCard035["clock"];
  kickoff: ScoreCard035["kickoff"];
  match: ScoreCard035["match"];
  depth: ScoreCard035["depth"];
  coverage: ScoreCard035["coverage"];
  holdout: ScoreCard035["holdout"];
}): ScoreCard035 {
  return {
    ...input,
    total: input.clock + input.kickoff + input.match + input.depth + input.coverage + input.holdout,
  };
}

export function coverageScore035(n: number): ScoreCard035["coverage"] {
  if (n < 100) return 0;
  if (n < 1000) return 1;
  if (n <= 10_000) return 2;
  return 3;
}
