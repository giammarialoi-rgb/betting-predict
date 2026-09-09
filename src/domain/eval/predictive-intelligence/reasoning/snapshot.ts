import { appendFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import type { FeatureDatum } from "@/domain/eval/predictive-intelligence/types";

export type ReasoningWhyPi = {
  strengths: string[];
  weaknesses: string[];
  contextual_factors: string[];
  data_quality: string[];
  uncertainty: string[];
};

export type ReasoningSnapshotPi = {
  event_id: string;
  model_version: string;
  feature_snapshot: Record<string, number | null>;
  feature_data?: FeatureDatum[];
  model_probability: Record<string, number> | null;
  market_probability: Record<string, number> | null;
  edge: number | null;
  ev: number | null;
  decision: string | null;
  confidence: number | null;
  data_coverage: number | null;
  feature_coverage: number | null;
  why: ReasoningWhyPi;
  at: string;
  real_money: false;
};

function pushUnique(arr: string[], v: string): void {
  if (v && !arr.includes(v)) arr.push(v);
}

/** Build WHY only from feature keys/values actually present — no decorative text. */
export function buildReasoningWhyFromFeatures(input: {
  values: Record<string, number | null>;
  missing_keys: string[];
  data_coverage?: number;
  feature_coverage?: number;
  data_quality?: number;
  uncertain?: boolean;
  insufficient?: boolean;
  feature_data?: FeatureDatum[];
  di_conflicts?: Array<{ field: string; sources: string[]; detail: string }>;
}): ReasoningWhyPi {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const contextual_factors: string[] = [];
  const data_quality: string[] = [];
  const uncertainty: string[] = [];

  const v = input.values;
  const strength = v.strength_diff_pts;
  if (strength != null && Number.isFinite(strength)) {
    if (strength > 0.2) pushUnique(strengths, `strength_diff_pts=${strength.toFixed(3)} (home stronger)`);
    else if (strength < -0.2)
      pushUnique(strengths, `strength_diff_pts=${strength.toFixed(3)} (away stronger)`);
    else pushUnique(contextual_factors, `strength_diff_pts=${strength.toFixed(3)} (near parity)`);
  } else {
    pushUnique(weaknesses, "strength_diff_pts=NOT_ELIGIBLE");
  }

  for (const w of [5, 10] as const) {
    const hg = v[`home_gf_l${w}`];
    const ag = v[`away_gf_l${w}`];
    if (hg != null && ag != null) {
      pushUnique(
        contextual_factors,
        `form_gf_l${w}: home=${hg.toFixed(2)} away=${ag.toFixed(2)}`,
      );
    }
  }

  if (v.home_advantage === 1) pushUnique(contextual_factors, "home_advantage=1");
  if (v.home_rest_days != null)
    pushUnique(contextual_factors, `home_rest_days=${Number(v.home_rest_days).toFixed(1)}`);
  if (v.away_rest_days != null)
    pushUnique(contextual_factors, `away_rest_days=${Number(v.away_rest_days).toFixed(1)}`);
  if (v.h2h_n != null && v.h2h_n > 0) {
    pushUnique(
      contextual_factors,
      `h2h_n=${v.h2h_n} home_win_rate=${v.h2h_home_win_rate ?? "N/A"}`,
    );
  } else {
    pushUnique(weaknesses, "h2h=INSUFFICIENT_OR_EMPTY");
  }

  if (v.home_elo != null) pushUnique(contextual_factors, `home_elo=${v.home_elo}`);
  if (v.away_elo != null) pushUnique(contextual_factors, `away_elo=${v.away_elo}`);
  if (v.home_injuries_n != null) {
    pushUnique(
      v.home_injuries_n > 0 ? weaknesses : contextual_factors,
      `home_injuries_n=${v.home_injuries_n}`,
    );
  }
  if (v.away_injuries_n != null) {
    pushUnique(
      v.away_injuries_n > 0 ? weaknesses : contextual_factors,
      `away_injuries_n=${v.away_injuries_n}`,
    );
  }
  if (v.home_lineup_confirmed === 1) pushUnique(strengths, "home_lineup_confirmed=1");
  if (v.away_lineup_confirmed === 1) pushUnique(strengths, "away_lineup_confirmed=1");

  for (const d of input.feature_data ?? []) {
    if (d.status === "NOT_ELIGIBLE") {
      pushUnique(data_quality, `${d.key}=NOT_ELIGIBLE source=${d.source}`);
    }
    if (d.status === "UNAVAILABLE") {
      pushUnique(data_quality, `${d.key}=UNAVAILABLE`);
    }
    if (d.status === "ELIGIBLE" && d.available_at) {
      pushUnique(contextual_factors, `${d.key}@${d.available_at.slice(0, 16)} (${d.source})`);
    }
  }

  for (const c of input.di_conflicts ?? []) {
    pushUnique(uncertainty, `conflict:${c.field} [${c.sources.join(",")}] ${c.detail}`);
    pushUnique(data_quality, `FEATURE_QUALITY_LOW:${c.field}`);
  }

  if (input.feature_coverage != null) {
    pushUnique(data_quality, `feature_coverage=${input.feature_coverage.toFixed(3)}`);
  }
  if (input.data_coverage != null) {
    pushUnique(data_quality, `data_coverage=${input.data_coverage.toFixed(3)}`);
  }
  if (input.data_quality != null) {
    pushUnique(data_quality, `data_quality=${input.data_quality.toFixed(3)}`);
  }
  if (input.missing_keys.length > 0) {
    pushUnique(data_quality, `missing_keys_n=${input.missing_keys.length}`);
  }
  if (input.insufficient) pushUnique(uncertainty, "INSUFFICIENT_DATA");
  if (input.uncertain) pushUnique(uncertainty, "MODEL_UNCERTAIN");

  return { strengths, weaknesses, contextual_factors, data_quality, uncertainty };
}

export function appendReasoningSnapshotPi(
  snap: ReasoningSnapshotPi,
  labBRoot?: string,
): void {
  const root = join(piRoot(labBRoot), "reasoning");
  mkdirSync(root, { recursive: true });
  appendFileSync(join(root, "snapshots.jsonl"), `${JSON.stringify(snap)}\n`, "utf8");
  appendFileSync(
    join(root, "by-event-index.jsonl"),
    `${JSON.stringify({ event_id: snap.event_id, at: snap.at })}\n`,
    "utf8",
  );
}

export function writeReasoningReportPi(input: {
  labBRoot?: string;
  nowIso: string;
  samples: number;
  note: string;
}): void {
  const root = piRoot(input.labBRoot);
  mkdirSync(root, { recursive: true });
  const path = join(root, "reasoning-report.json");
  const prev = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
    : {};
  writeFileSync(
    path,
    JSON.stringify(
      {
        ...prev,
        at: input.nowIso,
        samples_appended: input.samples,
        note: input.note,
        real_money: false,
        decorative_why_forbidden: true,
      },
      null,
      2,
    ),
  );
}
