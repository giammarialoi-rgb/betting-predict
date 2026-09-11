/**
 * Compute analisi light for one event from real history + optional attach hits.
 * Strong gates are not consulted and not lowered.
 */
import { attachAcquisitionCacheToEvent } from "@/domain/eval/data-intelligence/research/attach-acquisition-cache";
import { pickFavorite1x2 } from "@/domain/eval/light-analysis/favorite";
import {
  buildLightMarkets,
  cutoffDayFromKickoff,
  splitPriors,
} from "@/domain/eval/light-analysis/frequencies";
import { historySourceIds, loadHistoricalMatches } from "@/domain/eval/light-analysis/history";
import { proseFromMarkets } from "@/domain/eval/light-analysis/prose";
import type {
  HistoricalMatchRow,
  LightAnalysis,
  LightAttachHit,
} from "@/domain/eval/light-analysis/types";

export type LightComputeInput = {
  event_id: string;
  home: string;
  away: string;
  competition?: string | null;
  kickoff_utc?: string | null;
  sport?: string | null;
  status?: string | null;
  score_home?: number | null;
  score_away?: number | null;
  cwd?: string;
  nowIso?: string;
  history?: HistoricalMatchRow[];
  attach?: LightAttachHit[];
  strong_available?: boolean;
  skipAttach?: boolean;
};

export function computeLightAnalysis(input: LightComputeInput): LightAnalysis {
  const cwd = input.cwd ?? process.cwd();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const history = input.history ?? loadHistoricalMatches(cwd);
  const cutoff = cutoffDayFromKickoff(input.kickoff_utc ?? null);
  const priors = splitPriors(history, input.home, input.away, cutoff);
  const source_ids = historySourceIds([...priors.homeHome, ...priors.awayAway]);

  const attach: LightAttachHit[] =
    input.attach ??
    (input.skipAttach
      ? []
      : attachAcquisitionCacheToEvent({
          cwd,
          home: input.home,
          away: input.away,
          kickoffIso: input.kickoff_utc ?? null,
        }));

  const attachOk = attach.filter((a) => a.ok).map((a) => a.source_id);
  const markets = buildLightMarkets({
    homeHome: priors.homeHome,
    awayAway: priors.awayAway,
    source_ids,
  });

  const homeM = markets.find((m) => m.market === "1x2" && m.selection === "HOME");
  const drawM = markets.find((m) => m.market === "1x2" && m.selection === "DRAW");
  const awayM = markets.find((m) => m.market === "1x2" && m.selection === "AWAY");
  const favorite_1x2 =
    homeM?.probability != null && drawM?.probability != null && awayM?.probability != null
      ? pickFavorite1x2({
          home: homeM.probability,
          draw: drawM.probability,
          away: awayM.probability,
        })
      : null;

  const sources_used = [...new Set([...source_ids, ...attachOk])];
  const strong_available = input.strong_available === true;

  return {
    event_id: input.event_id,
    home: input.home,
    away: input.away,
    competition: input.competition ?? null,
    kickoff_utc: input.kickoff_utc ?? null,
    sport: input.sport ?? "FOOTBALL",
    status: input.status ?? null,
    score_home: input.score_home ?? null,
    score_away: input.score_away ?? null,
    analyzed_at: nowIso,
    mode: "light",
    mode_label_it: "Light",
    sources_used,
    attach,
    markets,
    favorite_1x2,
    prose: proseFromMarkets(markets),
    history_n: {
      home_home: priors.homeHome.length,
      away_away: priors.awayAway.length,
      team_any: priors.any.length,
      corners: [...priors.homeHome, ...priors.awayAway].filter(
        (r) => r.home_corners != null && r.away_corners != null,
      ).length,
    },
    identity_fail_closed: true,
    odds_entered_model: false,
    light_match: "alias",
    strong_available,
    strong_unavailable_it: strong_available ? null : "Forte non disponibile.",
  };
}

export function lightHasEstimableMarket(analysis: LightAnalysis): boolean {
  return analysis.markets.some((m) => m.status === "OK" && m.probability != null);
}
