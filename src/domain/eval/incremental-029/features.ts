import type { Family029 } from "@/domain/eval/incremental-029/types";
import type { Disagreement029 } from "@/domain/eval/incremental-029/overlay";

export type TeamState029 = {
  elo: number;
  formPts: number[];
  gf: number[];
  ga: number[];
  homePts: number[];
  awayPts: number[];
  kickoffs: number[];
};

const ELO_START = 1500;
const ELO_K = 20;
const DAY = 86_400_000;

export function emptyTeam(): TeamState029 {
  return { elo: ELO_START, formPts: [], gf: [], ga: [], homePts: [], awayPts: [], kickoffs: [] };
}

export function familyVector(input: {
  family: Family029;
  home: TeamState029;
  away: TeamState029;
  asOfMs: number;
  disagree: Disagreement029;
}): number[] {
  const h = input.home;
  const a = input.away;
  if (input.family === "elo") return [(h.elo - a.elo) / 400];
  if (input.family === "form") {
    const n = Math.min(5, h.formPts.length, a.formPts.length);
    const hp = n ? h.formPts.slice(-n).reduce((s, x) => s + x, 0) / (3 * n) : 0;
    const ap = n ? a.formPts.slice(-n).reduce((s, x) => s + x, 0) / (3 * n) : 0;
    const hg = n ? h.gf.slice(-n).reduce((s, x) => s + x, 0) / n : 0;
    const ag = n ? a.gf.slice(-n).reduce((s, x) => s + x, 0) / n : 0;
    return [hp - ap, (hg - ag) / 3, n / 5];
  }
  if (input.family === "schedule") {
    const rest = (t: TeamState029) => {
      const last = t.kickoffs[t.kickoffs.length - 1];
      if (last == null) return 0;
      return Math.min(21, (input.asOfMs - last) / DAY) / 14;
    };
    const cong = (t: TeamState029) =>
      t.kickoffs.filter((k) => k < input.asOfMs && input.asOfMs - k <= 7 * DAY).length / 4;
    const hs = h.homePts.length
      ? h.homePts.slice(-8).reduce((s, x) => s + x, 0) / (3 * Math.min(8, h.homePts.length))
      : 0;
    const asv = a.awayPts.length
      ? a.awayPts.slice(-8).reduce((s, x) => s + x, 0) / (3 * Math.min(8, a.awayPts.length))
      : 0;
    return [rest(h) - rest(a), cong(h) - cong(a), hs - asv];
  }
  if (input.family === "disagreement") {
    if (input.disagree.n < 2) return [0, 0, 0];
    return [input.disagree.n / 32, input.disagree.stdHome, input.disagree.consensusMinusPrimaryHome];
  }
  return [0];
}

export function updateTeam(input: {
  home: TeamState029;
  away: TeamState029;
  ftHome: number;
  ftAway: number;
  kickMs: number;
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
  input.home.homePts.push(homePts);
  input.away.awayPts.push(awayPts);
  input.home.kickoffs.push(input.kickMs);
  input.away.kickoffs.push(input.kickMs);
}
