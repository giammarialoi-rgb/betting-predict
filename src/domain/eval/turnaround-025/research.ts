import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import { reconstructPrematchFeatures } from "@/domain/eval/actuarial-018/reconstruct";
import { meanBrier, stage1Probability, type ModelId025 } from "@/domain/eval/turnaround-025/models";
import type { ResearchDiag025 } from "@/domain/eval/turnaround-025/types";

const MIN_PRIOR = 50;
const EDGE = 0.03;

function actualIdx(result: ClubMatchLite["result"]): 0 | 1 | 2 | null {
  if (result === "HOME") return 0;
  if (result === "DRAW") return 1;
  if (result === "AWAY") return 2;
  return null;
}

export function researchDiagnostic(input: {
  matches: readonly ClubMatchLite[];
  note?: string;
}): ResearchDiag025 {
  const withOdds = input.matches.filter(
    (m) =>
      m.oddHome != null &&
      m.oddDraw != null &&
      m.oddAway != null &&
      m.oddHome > 1 &&
      m.oddDraw > 1 &&
      m.oddAway > 1 &&
      m.result != null,
  ).length;
  if (input.matches.length === 0) {
    return {
      events: 0,
      with_odds: 0,
      decisions: 0,
      would_be_edge_candidates_if_illegal_date_only: 0,
      bets: 0,
      market_brier: null,
      frequency_brier: null,
      form_brier: null,
      elo_brier: null,
      poisson_brier: null,
      market_beats_frequency: null,
      note: input.note ?? "no Club-Football rows loaded",
    };
  }
  const feats = reconstructPrematchFeatures(input.matches);
  const featById = new Map(feats.map((f) => [f.eventId, f]));
  let h = 0;
  let d = 0;
  let a = 0;
  const buckets: Record<string, { p: [number, number, number]; actual: 0 | 1 | 2 }[]> = {
    market_devig: [],
    frequency: [],
    form: [],
    elo: [],
    poisson: [],
  };
  let illegalCandidates = 0;
  let decisions = 0;
  for (const m of input.matches) {
    const idx = actualIdx(m.result);
    const prior = h + d + a;
    const freq: [number, number, number] =
      prior === 0 ? [1 / 3, 1 / 3, 1 / 3] : [h / prior, d / prior, a / prior];
    const feat = featById.get(m.eventId);
    const hasOdds =
      m.oddHome != null && m.oddDraw != null && m.oddAway != null && m.oddHome > 1 && m.oddDraw > 1 && m.oddAway > 1;
    if (idx != null && hasOdds && prior >= MIN_PRIOR && feat) {
      decisions += 1;
      const stageIn = {
        marketOdds: { home: m.oddHome!, draw: m.oddDraw!, away: m.oddAway! },
        freq,
        formHomePts: feat.home_form_5.points,
        formAwayPts: feat.away_form_5.points,
        formSample: Math.min(feat.home_form_5.sample, feat.away_form_5.sample),
        eloDiff: feat.research_elo_diff,
        gfHome: feat.home_form_5.goals_for,
        gaHome: feat.home_form_5.goals_against,
        gfAway: feat.away_form_5.goals_for,
        gaAway: feat.away_form_5.goals_against,
        microstructureAvailable: false,
      };
      for (const id of Object.keys(buckets) as ModelId025[]) {
        const p = stage1Probability(id, stageIn);
        if (p) buckets[id]!.push({ p, actual: idx });
      }
      const formP = stage1Probability("form", stageIn);
      const mkt = stage1Probability("market_devig", stageIn);
      if (formP && mkt) {
        const side = formP[0]! >= formP[1]! && formP[0]! >= formP[2]! ? 0 : formP[1]! >= formP[2]! ? 1 : 2;
        if (formP[side]! - mkt[side]! >= EDGE) illegalCandidates += 1;
      }
    }
    if (idx === 0) h += 1;
    else if (idx === 1) d += 1;
    else if (idx === 2) a += 1;
  }
  const market_brier = meanBrier(buckets.market_devig!);
  const frequency_brier = meanBrier(buckets.frequency!);
  return {
    events: input.matches.length,
    with_odds: withOdds,
    decisions,
    would_be_edge_candidates_if_illegal_date_only: illegalCandidates,
    bets: 0,
    market_brier,
    frequency_brier,
    form_brier: meanBrier(buckets.form!),
    elo_brier: meanBrier(buckets.elo!),
    poisson_brier: meanBrier(buckets.poisson!),
    market_beats_frequency:
      market_brier != null && frequency_brier != null ? market_brier < frequency_brier : null,
    note:
      input.note ??
      "RESEARCH_ONLY DATE_ONLY Club Odd*. capital_eligible=false. Brier is diagnostic, not a 1000 bankroll.",
  };
}
