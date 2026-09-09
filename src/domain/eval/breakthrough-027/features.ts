import { normalizeTeam } from "@/domain/eval/acquisition-019/team-normalize";
import type { Stage1Input } from "@/domain/eval/turnaround-025/models";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";

const ELO_START = 1500;
const ELO_K = 20;

export type TeamState027 = {
  elo: number;
  formPts: number[];
  gf: number[];
  ga: number[];
  lastTs: number | null;
};

export function emptyTeamState(): TeamState027 {
  return { elo: ELO_START, formPts: [], gf: [], ga: [], lastTs: null };
}

export function stageInputFromState(input: {
  event: StrictCandidate027;
  home: TeamState027;
  away: TeamState027;
  freq: [number, number, number];
}): Stage1Input {
  const formN = 5;
  const hForm = input.home.formPts.slice(-formN);
  const aForm = input.away.formPts.slice(-formN);
  const sample = Math.min(hForm.length, aForm.length);
  return {
    marketOdds: {
      home: input.event.home_odds,
      draw: input.event.draw_odds,
      away: input.event.away_odds,
    },
    freq: input.freq,
    formHomePts: hForm.reduce((s, x) => s + x, 0),
    formAwayPts: aForm.reduce((s, x) => s + x, 0),
    formSample: sample,
    eloDiff: input.home.elo - input.away.elo,
    gfHome: input.home.gf.slice(-formN).reduce((s, x) => s + x, 0),
    gaHome: input.home.ga.slice(-formN).reduce((s, x) => s + x, 0),
    gfAway: input.away.gf.slice(-formN).reduce((s, x) => s + x, 0),
    gaAway: input.away.ga.slice(-formN).reduce((s, x) => s + x, 0),
    microstructureAvailable: true,
  };
}

export function updateAfterReveal(input: {
  home: TeamState027;
  away: TeamState027;
  ftHome: number;
  ftAway: number;
  ts: number;
}): void {
  const homePts = input.ftHome > input.ftAway ? 3 : input.ftHome === input.ftAway ? 1 : 0;
  const awayPts = input.ftAway > input.ftHome ? 3 : input.ftHome === input.ftAway ? 1 : 0;
  const expectedHome = 1 / (1 + 10 ** (-(input.home.elo - input.away.elo) / 400));
  const actualHome = input.ftHome > input.ftAway ? 1 : input.ftHome === input.ftAway ? 0.5 : 0;
  input.home.elo += ELO_K * (actualHome - expectedHome);
  input.away.elo += ELO_K * (expectedHome - actualHome);
  input.home.formPts.push(homePts);
  input.away.formPts.push(awayPts);
  input.home.gf.push(input.ftHome);
  input.home.ga.push(input.ftAway);
  input.away.gf.push(input.ftAway);
  input.away.ga.push(input.ftHome);
  input.home.lastTs = input.ts;
  input.away.lastTs = input.ts;
}

export function teamKey(name: string): string {
  return normalizeTeam(name).slug || name.toLowerCase();
}
