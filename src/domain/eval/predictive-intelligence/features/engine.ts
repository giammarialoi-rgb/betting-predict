import { PI_FEATURES_VERSION } from "@/domain/eval/predictive-intelligence/config";
import {
  assertNoClosingOddsInPredictionContext,
  assertNoFutureLeakage,
  assertNoMarketInputsInPredictionContext,
  assertTemporalExample,
  featureCutoffForMatch,
  priorMatchesAsOf,
} from "@/domain/eval/predictive-intelligence/features/asof";
import type {
  FeatureDatum,
  PiFeatureVector,
  PiMatchRow,
  PiTemporalExample,
} from "@/domain/eval/predictive-intelligence/types";
import type { ClubEloObservation } from "@/domain/features/clubelo-asof";
import { resolveTeamEloAsOf } from "@/domain/eval/data-intelligence/clubelo-cache";
import { mergeDiIntoFeatureVector } from "@/domain/eval/data-intelligence/feature-bag";

type TeamAgg = {
  n: number;
  gf: number;
  ga: number;
  pts: number;
  shots: number;
  shotsN: number;
  sot: number;
  sotN: number;
  corners: number;
  cornersN: number;
  cards: number;
  cardsN: number;
  cleanSheets: number;
  scored: number;
  xg: number;
  xgN: number;
  xga: number;
  xgaN: number;
};

function emptyAgg(): TeamAgg {
  return {
    n: 0,
    gf: 0,
    ga: 0,
    pts: 0,
    shots: 0,
    shotsN: 0,
    sot: 0,
    sotN: 0,
    corners: 0,
    cornersN: 0,
    cards: 0,
    cardsN: 0,
    cleanSheets: 0,
    scored: 0,
    xg: 0,
    xgN: 0,
    xga: 0,
    xgaN: 0,
  };
}

function ptsFor(label: "HOME" | "DRAW" | "AWAY", isHome: boolean): number {
  if (label === "DRAW") return 1;
  if (label === "HOME") return isHome ? 3 : 0;
  return isHome ? 0 : 3;
}

function teamView(m: PiMatchRow, teamId: string): {
  gf: number;
  ga: number;
  shots: number | null;
  sot: number | null;
  corners: number | null;
  cards: number | null;
  xg: number | null;
  xga: number | null;
  isHome: boolean;
  label: "HOME" | "DRAW" | "AWAY";
} | null {
  if (m.home_team_id === teamId) {
    return {
      gf: m.fthg,
      ga: m.ftag,
      shots: m.hs,
      sot: m.hst,
      corners: m.hc,
      cards: m.hy != null || m.hr != null ? (m.hy ?? 0) + 2 * (m.hr ?? 0) : null,
      xg: m.hxg ?? null,
      xga: m.axg ?? null,
      isHome: true,
      label: m.ftr,
    };
  }
  if (m.away_team_id === teamId) {
    return {
      gf: m.ftag,
      ga: m.fthg,
      shots: m.as,
      sot: m.ast,
      corners: m.ac,
      cards: m.ay != null || m.ar != null ? (m.ay ?? 0) + 2 * (m.ar ?? 0) : null,
      xg: m.axg ?? null,
      xga: m.hxg ?? null,
      isHome: false,
      label: m.ftr,
    };
  }
  return null;
}

function aggregate(matches: PiMatchRow[], teamId: string, venue?: "home" | "away"): TeamAgg {
  const a = emptyAgg();
  for (const m of matches) {
    const v = teamView(m, teamId);
    if (!v) continue;
    if (venue === "home" && !v.isHome) continue;
    if (venue === "away" && v.isHome) continue;
    a.n += 1;
    a.gf += v.gf;
    a.ga += v.ga;
    a.pts += ptsFor(v.label, v.isHome);
    if (v.ga === 0) a.cleanSheets += 1;
    if (v.gf > 0) a.scored += 1;
    if (v.shots != null) {
      a.shots += v.shots;
      a.shotsN += 1;
    }
    if (v.sot != null) {
      a.sot += v.sot;
      a.sotN += 1;
    }
    if (v.corners != null) {
      a.corners += v.corners;
      a.cornersN += 1;
    }
    if (v.cards != null) {
      a.cards += v.cards;
      a.cardsN += 1;
    }
    if (v.xg != null) {
      a.xg += v.xg;
      a.xgN += 1;
    }
    if (v.xga != null) {
      a.xga += v.xga;
      a.xgaN += 1;
    }
  }
  return a;
}

function lastN(matches: PiMatchRow[], teamId: string, n: number): PiMatchRow[] {
  const out: PiMatchRow[] = [];
  for (let i = matches.length - 1; i >= 0 && out.length < n; i -= 1) {
    const m = matches[i]!;
    if (m.home_team_id === teamId || m.away_team_id === teamId) out.push(m);
  }
  return out.reverse();
}

function rate(
  a: TeamAgg,
  key: keyof TeamAgg,
  countKey: "n" | "shotsN" | "sotN" | "cornersN" | "cardsN" | "xgN" | "xgaN",
): number | null {
  const c = a[countKey] as number;
  if (c <= 0) return null;
  return (a[key] as number) / c;
}

function restDays(matches: PiMatchRow[], teamId: string, eventTime: string): number | null {
  let last: string | null = null;
  for (const m of matches) {
    if (m.home_team_id === teamId || m.away_team_id === teamId) last = m.event_time;
  }
  if (!last) return null;
  const d = (Date.parse(eventTime) - Date.parse(last)) / 86400000;
  return Number.isFinite(d) ? d : null;
}

function h2h(
  matches: PiMatchRow[],
  homeId: string,
  awayId: string,
): { n: number; home_wins: number; draws: number; away_wins: number } {
  let n = 0;
  let home_wins = 0;
  let draws = 0;
  let away_wins = 0;
  for (const m of matches) {
    const pair =
      (m.home_team_id === homeId && m.away_team_id === awayId) ||
      (m.home_team_id === awayId && m.away_team_id === homeId);
    if (!pair) continue;
    n += 1;
    if (m.ftr === "DRAW") draws += 1;
    else if (m.home_team_id === homeId && m.ftr === "HOME") home_wins += 1;
    else if (m.away_team_id === homeId && m.ftr === "AWAY") home_wins += 1;
    else away_wins += 1;
  }
  return { n, home_wins, draws, away_wins };
}

function put(
  values: Record<string, number | null>,
  missing: string[],
  key: string,
  v: number | null,
): void {
  values[key] = v;
  if (v == null || !Number.isFinite(v)) missing.push(key);
}

/** Build PRE-MATCH features using only prior information. Never uses closing odds. */
export function buildFeatureVectorPi(
  target: PiMatchRow,
  universe: readonly PiMatchRow[],
  opts?: {
    clubElo?: readonly ClubEloObservation[];
    /** ELIGIBLE DI features (injuries/lineups/elo) — never odds/scrape/meteo. */
    diFeatures?: Map<string, FeatureDatum> | FeatureDatum[];
  },
): PiFeatureVector {
  const feature_cutoff = featureCutoffForMatch(target);
  const priors = priorMatchesAsOf(universe, feature_cutoff).filter((m) => m.canonical_id !== target.canonical_id);
  assertNoFutureLeakage({ featureCutoff: feature_cutoff, usedMatches: priors, targetId: target.canonical_id });

  const feature_source_time =
    priors.length === 0
      ? feature_cutoff
      : priors.map((m) => m.result_available_at).sort().at(-1)!;

  const example: PiTemporalExample = {
    canonical_id: target.canonical_id,
    event_time: target.event_time,
    feature_cutoff,
    feature_source_time,
    label_time: target.label_time,
    label: target.ftr,
    league: target.league,
    season: target.season,
  };
  assertTemporalExample(example);

  const seasonPriors = priors.filter((m) => m.season === target.season && m.league === target.league);
  const leaguePriors = priors.filter((m) => m.league === target.league);
  /** Live / unmapped season: form + venue fall back to same-league priors (still as-of cut). */
  const formPriors = seasonPriors.length ? seasonPriors : leaguePriors;
  const venuePriors = seasonPriors.length ? seasonPriors : leaguePriors;

  const values: Record<string, number | null> = {};
  const missing: string[] = [];

  const windowIds: { home: Record<number, string[]>; away: Record<number, string[]> } = {
    home: {},
    away: {},
  };
  const windows = [3, 5, 10] as const;
  for (const w of windows) {
    const hM = lastN(formPriors, target.home_team_id, w);
    const aM = lastN(formPriors, target.away_team_id, w);
    windowIds.home[w] = hM.map((m) => m.canonical_id);
    windowIds.away[w] = aM.map((m) => m.canonical_id);
    const hA = aggregate(hM, target.home_team_id);
    const aA = aggregate(aM, target.away_team_id);
    put(values, missing, `home_gf_l${w}`, rate(hA, "gf", "n"));
    put(values, missing, `home_ga_l${w}`, rate(hA, "ga", "n"));
    put(values, missing, `home_pts_l${w}`, rate(hA, "pts", "n"));
    put(values, missing, `away_gf_l${w}`, rate(aA, "gf", "n"));
    put(values, missing, `away_ga_l${w}`, rate(aA, "ga", "n"));
    put(values, missing, `away_pts_l${w}`, rate(aA, "pts", "n"));
    put(values, missing, `home_shots_l${w}`, rate(hA, "shots", "shotsN"));
    put(values, missing, `away_shots_l${w}`, rate(aA, "shots", "shotsN"));
    put(values, missing, `home_sot_l${w}`, rate(hA, "sot", "sotN"));
    put(values, missing, `away_sot_l${w}`, rate(aA, "sot", "sotN"));
    put(values, missing, `home_corners_l${w}`, rate(hA, "corners", "cornersN"));
    put(values, missing, `away_corners_l${w}`, rate(aA, "corners", "cornersN"));
    put(values, missing, `home_cards_l${w}`, rate(hA, "cards", "cardsN"));
    put(values, missing, `away_cards_l${w}`, rate(aA, "cards", "cardsN"));
    put(values, missing, `home_cs_l${w}`, hA.n ? hA.cleanSheets / hA.n : null);
    put(values, missing, `away_cs_l${w}`, aA.n ? aA.cleanSheets / aA.n : null);
    put(values, missing, `home_score_cons_l${w}`, hA.n ? hA.scored / hA.n : null);
    put(values, missing, `away_score_cons_l${w}`, aA.n ? aA.scored / aA.n : null);
    put(values, missing, `home_xg_l${w}`, rate(hA, "xg", "xgN"));
    put(values, missing, `away_xg_l${w}`, rate(aA, "xg", "xgN"));
    put(values, missing, `home_xga_l${w}`, rate(hA, "xga", "xgaN"));
    put(values, missing, `away_xga_l${w}`, rate(aA, "xga", "xgaN"));
  }

  const hHome = aggregate(venuePriors, target.home_team_id, "home");
  const aAway = aggregate(venuePriors, target.away_team_id, "away");
  const hAll = aggregate(venuePriors, target.home_team_id);
  const aAll = aggregate(venuePriors, target.away_team_id);

  put(values, missing, "home_attack_home", rate(hHome, "gf", "n"));
  put(values, missing, "home_defense_home", rate(hHome, "ga", "n"));
  put(values, missing, "away_attack_away", rate(aAway, "gf", "n"));
  put(values, missing, "away_defense_away", rate(aAway, "ga", "n"));
  put(values, missing, "home_attack_all", rate(hAll, "gf", "n"));
  put(values, missing, "away_attack_all", rate(aAll, "gf", "n"));
  const homePtsRate = rate(hAll, "pts", "n");
  const awayPtsRate = rate(aAll, "pts", "n");
  put(
    values,
    missing,
    "strength_diff_pts",
    homePtsRate != null && awayPtsRate != null ? homePtsRate - awayPtsRate : null,
  );

  put(values, missing, "home_rest_days", restDays(priors, target.home_team_id, target.event_time));
  put(values, missing, "away_rest_days", restDays(priors, target.away_team_id, target.event_time));
  put(values, missing, "home_advantage", 1);

  const leagueAvgGf =
    leaguePriors.length > 0
      ? leaguePriors.reduce((s, m) => s + m.fthg + m.ftag, 0) / (2 * leaguePriors.length)
      : null;
  put(values, missing, "league_avg_gf", leagueAvgGf);

  const hh = h2h(priors, target.home_team_id, target.away_team_id);
  put(values, missing, "h2h_n", hh.n);
  put(values, missing, "h2h_home_win_rate", hh.n ? hh.home_wins / hh.n : null);
  put(values, missing, "h2h_draw_rate", hh.n ? hh.draws / hh.n : null);

  // season phase proxy: match index / expected ~38
  const seasonPlayed =
    venuePriors.filter(
      (m) => m.home_team_id === target.home_team_id || m.away_team_id === target.home_team_id,
    ).length;
  put(values, missing, "season_phase", seasonPlayed / 38);

  // ClubElo SAFE — only from supplied local observations; never network
  const eloObs = opts?.clubElo ?? [];
  const homeElo = eloObs.length
    ? resolveTeamEloAsOf({
        observations: eloObs,
        teamName: target.home_team,
        matchDateIso: target.match_date || target.event_time,
      })
    : null;
  const awayElo = eloObs.length
    ? resolveTeamEloAsOf({
        observations: eloObs,
        teamName: target.away_team,
        matchDateIso: target.match_date || target.event_time,
      })
    : null;
  if (eloObs.length) {
    put(values, missing, "home_elo", homeElo?.rating ?? null);
    put(values, missing, "away_elo", awayElo?.rating ?? null);
    put(
      values,
      missing,
      "elo_diff",
      homeElo && awayElo ? homeElo.rating - awayElo.rating : null,
    );
  }

  assertNoClosingOddsInPredictionContext(Object.keys(values));
  assertNoMarketInputsInPredictionContext(Object.keys(values));

  const keys = Object.keys(values);
  const provenanceFor = (key: string): {
    derived_from: string[];
    calculation: string;
    origin: NonNullable<FeatureDatum["origin"]>;
  } => {
    if (key === "home_advantage" || key === "season_phase") {
      return { derived_from: [], calculation: "static/contextual", origin: "STATIC" };
    }
    const roll = key.match(/^(home|away)_[a-z_]+_l(3|5|10)$/);
    if (roll) {
      const side = roll[1] as "home" | "away";
      const w = Number(roll[2]);
      const ids = windowIds[side][w] ?? [];
      return {
        derived_from: ids,
        calculation: `rolling mean over last ${w} prior matches excluding target`,
        origin: "DERIVED",
      };
    }
    if (key.startsWith("h2h")) {
      return {
        derived_from: [],
        calculation: "head-to-head priors excluding target",
        origin: "DERIVED",
      };
    }
    return {
      derived_from: [],
      calculation: "derived from football-data priors excluding target",
      origin: "DERIVED",
    };
  };
  const feature_data: FeatureDatum[] = keys.map((key) => {
    const value = values[key]!;
    const isElo = key === "home_elo" || key === "away_elo" || key === "elo_diff";
    const prov = provenanceFor(key);

    if (isElo) {
      const avail =
        key === "home_elo"
          ? homeElo?.available_at ?? null
          : key === "away_elo"
            ? awayElo?.available_at ?? null
            : homeElo && awayElo
              ? homeElo.available_at
              : null;
      const eligible = value != null && Number.isFinite(value) && avail != null;
      return {
        key,
        source: "clubelo",
        event_id: target.canonical_id,
        available_at: eligible ? avail : null,
        feature_time: feature_cutoff,
        value: eligible ? value : null,
        quality: eligible ? 1 : 0,
        status: eligible ? ("ELIGIBLE" as const) : ("NOT_ELIGIBLE" as const),
        temporal_precision: "DATE_ONLY" as const,
        derived_from: [],
        calculation: "clubelo rating_date < match_date",
        origin: "HISTORICAL_ARCHIVE",
        entered_model: eligible,
      };
    }

    const eligible = value != null && Number.isFinite(value);
    return {
      key,
      source: "football-data-co-uk",
      event_id: target.canonical_id,
      available_at: eligible ? feature_source_time : null,
      feature_time: feature_cutoff,
      value: eligible ? value : null,
      quality: eligible ? 1 : 0,
      status: eligible ? ("ELIGIBLE" as const) : ("NOT_ELIGIBLE" as const),
      temporal_precision: "DATE_ONLY" as const,
      derived_from: prov.derived_from,
      calculation: prov.calculation,
      origin: prov.origin,
      entered_model: eligible,
    };
  });

  if (!eloObs.length) {
    for (const key of ["home_elo", "away_elo", "elo_diff"] as const) {
      feature_data.push({
        key,
        source: "clubelo",
        event_id: target.canonical_id,
        available_at: null,
        feature_time: feature_cutoff,
        value: null,
        quality: null,
        status: "UNAVAILABLE",
        temporal_precision: "DATE_ONLY",
      });
    }
  }

  // Explicit UNAVAILABLE placeholders for audit coverage (not in model bag)
  for (const key of [
    "home_xg_prematch",
    "away_xg_prematch",
    "home_injuries_n",
    "away_injuries_n",
    "home_lineup_confirmed",
    "away_lineup_confirmed",
    "ppda_home",
    "ppda_away",
  ] as const) {
    feature_data.push({
      key,
      source: "none",
      event_id: target.canonical_id,
      available_at: null,
      feature_time: feature_cutoff,
      value: null,
      quality: null,
      status: "UNAVAILABLE",
      temporal_precision: "UNKNOWN",
      derived_from: [],
      calculation: null,
      origin: "LIVE_RESEARCH",
      entered_model: false,
    });
  }

  const modelKeys = keys;
  const usable = feature_data.filter(
    (d) => modelKeys.includes(d.key) && d.status === "ELIGIBLE",
  );
  const feature_coverage = modelKeys.length ? usable.length / modelKeys.length : 0;
  const data_coverage = Math.min(1, priors.length / 40);
  const data_quality = Math.round((0.55 * feature_coverage + 0.45 * data_coverage) * 1000) / 1000;

  // Strip non-eligible values from the bag used by the model
  for (const d of feature_data) {
    if (d.status !== "ELIGIBLE" && modelKeys.includes(d.key)) values[d.key] = null;
  }

  const base: PiFeatureVector = {
    example,
    values,
    missing_keys: missing,
    closing_odds_used: false,
    features_version: PI_FEATURES_VERSION,
    feature_data,
    data_coverage,
    feature_coverage,
    data_quality,
  };

  if (opts?.diFeatures) {
    const merged = mergeDiIntoFeatureVector(base, opts.diFeatures);
    assertNoClosingOddsInPredictionContext(Object.keys(merged.values));
    assertNoMarketInputsInPredictionContext(Object.keys(merged.values));
    return merged;
  }
  return base;
}

export function featureManifestPi(keys: string[]) {
  return {
    features_version: PI_FEATURES_VERSION,
    keys: [...keys].sort(),
    closing_odds_in_features: false,
    windows: [3, 5, 10, "season", "h2h"],
    missing_policy: "explicit_null_no_future_imputation",
  };
}
