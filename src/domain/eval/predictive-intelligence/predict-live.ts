import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PI_MODEL_INDEPENDENT_ID,
  piModelsRoot,
  piRoot,
} from "@/domain/eval/predictive-intelligence/config";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import {
  DEFAULT_POISSON_PARAMS,
  predictPoissonIndependentDetailed,
  type PoissonIndependentDetail,
  type PoissonParamsPi,
} from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import { assertProbSumsToOne, probsClose } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import { sportAdapterStatuses } from "@/domain/eval/predictive-intelligence/sport-adapters";
import {
  buildReasoningWhyFromFeatures,
  type ReasoningWhyPi,
} from "@/domain/eval/predictive-intelligence/reasoning/snapshot";
import type { FeatureDatum, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { loadClubEloCacheSync } from "@/domain/eval/data-intelligence/clubelo-cache";
import { clubEloCachePresent } from "@/domain/eval/data-intelligence/registry";
import { synthesizeFeatureBag } from "@/domain/eval/data-intelligence/feature-bag";
import { loadUnderstatCacheSync } from "@/domain/eval/data-intelligence/research/understat-league";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import type { PrematchFeatureObservation } from "@/domain/eval/data-intelligence/types";
import { resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";

export type IndependentPredictResult = {
  ok: boolean;
  model_version: string;
  probability_model: Record<string, number> | null;
  market_only: false;
  insufficient_data: boolean;
  uncertain: boolean;
  reason_codes: string[];
  feature_snapshot: Record<string, number | null> | null;
  feature_data: FeatureDatum[] | null;
  features_version: string | null;
  closing_odds_used: false;
  data_coverage: number | null;
  feature_coverage: number | null;
  data_quality: number | null;
  model_confidence: number | null;
  why: ReasoningWhyPi | null;
  di_conflicts?: Array<{ field: string; sources: string[]; detail: string }>;
  poisson?: Pick<PoissonIndependentDetail, "lambda_home" | "lambda_away"> | null;
};

function loadPoissonParams(labBRoot?: string): PoissonParamsPi {
  const p = join(piModelsRoot(labBRoot), `${PI_MODEL_INDEPENDENT_ID}.json`);
  if (!existsSync(p)) return DEFAULT_POISSON_PARAMS;
  try {
    return { ...DEFAULT_POISSON_PARAMS, ...(JSON.parse(readFileSync(p, "utf8")) as PoissonParamsPi) };
  } catch {
    return DEFAULT_POISSON_PARAMS;
  }
}

function resolveTeamIds(home?: string | null, away?: string | null): { home: string; away: string } {
  return {
    home: (home ?? "").trim().toLowerCase(),
    away: (away ?? "").trim().toLowerCase(),
  };
}

function failResult(
  codes: string[],
  extra?: Partial<IndependentPredictResult>,
): IndependentPredictResult {
  return {
    ok: false,
    model_version: PI_MODEL_INDEPENDENT_ID,
    probability_model: null,
    market_only: false,
    insufficient_data: true,
    uncertain: Boolean(extra?.uncertain),
    reason_codes: codes,
    feature_snapshot: extra?.feature_snapshot ?? null,
    feature_data: extra?.feature_data ?? null,
    features_version: extra?.features_version ?? null,
    closing_odds_used: false,
    data_coverage: extra?.data_coverage ?? null,
    feature_coverage: extra?.feature_coverage ?? null,
    data_quality: extra?.data_quality ?? null,
    model_confidence: extra?.model_confidence ?? null,
    why: extra?.why ?? null,
    di_conflicts: extra?.di_conflicts,
    poisson: extra?.poisson ?? null,
  };
}

/**
 * Live/independent prediction for soccer events.
 * Uses historical PI dataset priors; does NOT use market odds as model input.
 * `marketProbability` is optional and used ONLY for post-hoc near-market flag — never as MODEL input.
 */
export function predictIndependentForEvent(input: {
  sport: string;
  home_team?: string | null;
  away_team?: string | null;
  competition?: string | null;
  kickoff_utc?: string | null;
  marketProbability?: Record<string, number> | null;
  labBRoot?: string;
  /** Optional DI prematch observations (API-Sports etc.) — synthesized into MODEL bag when ELIGIBLE. */
  diObservations?: readonly PrematchFeatureObservation[];
  decisionTime?: string | null;
}): IndependentPredictResult {
  const sport = (input.sport ?? "").toLowerCase();
  const adapters = sportAdapterStatuses(loadPiMatches(input.labBRoot).length);
  const soccer = adapters.find((a) => a.sport === "SOCCER")!;

  if (sport && sport !== "soccer" && sport !== "football") {
    return failResult(["INSUFFICIENT_DATA", "SPORT_ADAPTER_INACTIVE"]);
  }

  if (soccer.status !== "ACTIVE") {
    return failResult(["INSUFFICIENT_DATA", "SOCCER_DATASET_INSUFFICIENT"]);
  }

  const matches = loadPiMatches(input.labBRoot);
  const { home, away } = resolveTeamIds(input.home_team, input.away_team);
  if (!home || !away) {
    return failResult(["INSUFFICIENT_DATA", "MISSING_TEAMS"]);
  }

  const kick = input.kickoff_utc ?? new Date().toISOString();
  const day = kick.slice(0, 10);
  const resolved = resolveLivePiTarget({
    home_team: input.home_team,
    away_team: input.away_team,
    competition: input.competition,
    matches,
  });
  const homeId = resolved.home_team_id;
  const awayId = resolved.away_team_id;
  const league = resolved.division ?? input.competition ?? "UNK";
  const season = resolved.season;

  const resolveCodes: string[] = [];
  if (!resolved.home_matched || !resolved.away_matched) {
    resolveCodes.push("TEAM_ID_PARTIAL_RESOLVE");
  }
  if (!resolved.division) {
    resolveCodes.push("COMPETITION_DIVISION_UNMAPPED");
  }
  if (resolved.home_matched && resolved.away_matched && resolved.division) {
    resolveCodes.push("PI_UNIVERSE_RESOLVED");
  }

  const target = {
    canonical_id: `live|${day}|${homeId}|${awayId}`,
    source: "football-data-co-uk" as const,
    season,
    league,
    match_date: day,
    event_time: kick,
    home_team: input.home_team ?? home,
    away_team: input.away_team ?? away,
    home_team_id: homeId,
    away_team_id: awayId,
    fthg: 0,
    ftag: 0,
    ftr: "DRAW" as const,
    hthg: null,
    htag: null,
    htr: null,
    hs: null,
    as: null,
    hst: null,
    ast: null,
    hc: null,
    ac: null,
    hy: null,
    ay: null,
    hr: null,
    ar: null,
    odds_open: {
      B365: { home: null, draw: null, away: null },
      PS: { home: null, draw: null, away: null },
      Avg: { home: null, draw: null, away: null },
    },
    research_odds_close: {
      B365C: { home: null, draw: null, away: null },
      PSC: { home: null, draw: null, away: null },
    },
    label_time: kick,
    result_available_at: kick,
  };

  const clubElo = clubEloCachePresent(process.cwd()) ? loadClubEloCacheSync(process.cwd()) : [];
  const understatMatches = loadUnderstatCacheSync(input.labBRoot ?? permanentRoot044());
  const decisionTime = input.decisionTime ?? kick;
  let diFeatures: Map<string, FeatureDatum> | undefined;
  let diConflicts: IndependentPredictResult["di_conflicts"];
  const diCodes: string[] = [];
  if (input.diObservations?.length) {
    const bag = synthesizeFeatureBag({
      eventId: target.canonical_id,
      decisionTime,
      observations: input.diObservations,
    });
    diFeatures = bag.features;
    diConflicts = bag.conflicts;
    diCodes.push(...bag.reason_codes);
  }

  const features = buildFeatureVectorPi(target, matches, {
    clubElo,
    diFeatures,
    understatMatches,
  });
  assertNoMarketInputsInPredictionContext(Object.keys(features.values));

  const whySparse = buildReasoningWhyFromFeatures({
    values: features.values,
    missing_keys: features.missing_keys,
    data_coverage: features.data_coverage,
    feature_coverage: features.feature_coverage,
    data_quality: features.data_quality,
    uncertain: true,
    insufficient: true,
    feature_data: features.feature_data,
    di_conflicts: diConflicts,
  });

  if (features.missing_keys.length > 45 || features.feature_coverage < 0.35) {
    return failResult(["INSUFFICIENT_DATA", "FEATURES_TOO_SPARSE", ...diCodes, ...resolveCodes], {
      uncertain: true,
      feature_snapshot: features.values,
      feature_data: features.feature_data,
      features_version: features.features_version,
      data_coverage: features.data_coverage,
      feature_coverage: features.feature_coverage,
      data_quality: features.data_quality,
      model_confidence: Math.round(features.data_quality * 40),
      why: whySparse,
      di_conflicts: diConflicts,
    });
  }

  const params = loadPoissonParams(input.labBRoot);
  const detail = predictPoissonIndependentDetailed({ features, params });
  const p: PiProb3 = detail.probability;
  assertProbSumsToOne(p);
  const asRecord = { HOME: p.HOME, DRAW: p.DRAW, AWAY: p.AWAY };

  const marketOnlyMirror =
    input.marketProbability != null &&
    probsClose(p, {
      HOME: input.marketProbability.HOME ?? input.marketProbability.home ?? 0,
      DRAW: input.marketProbability.DRAW ?? input.marketProbability.draw ?? 0,
      AWAY: input.marketProbability.AWAY ?? input.marketProbability.away ?? 0,
    });

  const codes = ["INDEPENDENT_MODEL", PI_MODEL_INDEPENDENT_ID, ...diCodes, ...resolveCodes];
  if (marketOnlyMirror) codes.push("MODEL_NEAR_MARKET", "EDGE_UNKNOWN_OR_LOW");
  const uncertain =
    features.missing_keys.length > 25 ||
    features.feature_coverage < 0.55 ||
    diCodes.includes("FEATURE_QUALITY_LOW");
  if (uncertain) codes.push("MODEL_UNCERTAIN");
  if (clubElo.length) codes.push("CLUBELO_ASOF");

  const model_confidence = Math.max(
    15,
    Math.min(95, Math.round(35 + features.feature_coverage * 40 + features.data_coverage * 25)),
  );

  const why = buildReasoningWhyFromFeatures({
    values: features.values,
    missing_keys: features.missing_keys,
    data_coverage: features.data_coverage,
    feature_coverage: features.feature_coverage,
    data_quality: features.data_quality,
    uncertain,
    insufficient: false,
    feature_data: features.feature_data,
    di_conflicts: diConflicts,
  });

  void existsSync(piRoot(input.labBRoot));

  return {
    ok: true,
    model_version: PI_MODEL_INDEPENDENT_ID,
    probability_model: asRecord,
    market_only: false,
    insufficient_data: false,
    uncertain,
    reason_codes: [...new Set(codes)],
    feature_snapshot: features.values,
    feature_data: features.feature_data,
    features_version: features.features_version,
    closing_odds_used: false,
    data_coverage: features.data_coverage,
    feature_coverage: features.feature_coverage,
    data_quality: features.data_quality,
    model_confidence,
    why,
    di_conflicts: diConflicts,
    poisson: { lambda_home: detail.lambda_home, lambda_away: detail.lambda_away },
  };
}
