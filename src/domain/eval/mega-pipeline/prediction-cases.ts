/**
 * Prediction cases — OPEN → LIVE → WON/LOST/… from real results only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { upsertPredictionCase } from "@/domain/eval/mega-pipeline/neon-runtime";
import type { PredictionCaseStatus } from "@/domain/eval/mega-pipeline/types";

export type PredictionCase = {
  prediction_id: string;
  event_id: string;
  market: string;
  selection: string;
  prediction_probability: number | null;
  odds_at_prediction: number | null;
  model_version: string | null;
  prediction_timestamp: string;
  as_of: string | null;
  status: PredictionCaseStatus;
  result: string | null;
  settled_at: string | null;
  pnl_simulated: number | null;
  data_quality: number | null;
};

function casesPath(root = permanentRoot044()): string {
  return join(root, "prediction-cases.json");
}

export function loadPredictionCases(root = permanentRoot044()): PredictionCase[] {
  const p = casesPath(root);
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as {
      cases?: PredictionCase[];
    };
    return Array.isArray(raw.cases) ? raw.cases : [];
  } catch {
    return [];
  }
}

export function savePredictionCases(cases: PredictionCase[], root = permanentRoot044()): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    casesPath(root),
    JSON.stringify({ updated_at: new Date().toISOString(), cases }, null, 2),
  );
}

/** Sync OPEN cases from Lab B predictions that lack a case row. */
export async function syncPredictionCasesFromStore(input: {
  labBRoot?: string;
  persistNeon?: boolean;
  nowIso?: string;
} = {}): Promise<{ created: number }> {
  const root = input.labBRoot ?? permanentRoot044();
  const store = loadStore044(root);
  const cases = loadPredictionCases(root);
  const byId = new Map(cases.map((c) => [c.prediction_id, c]));
  let created = 0;
  for (const pred of store.predictions) {
    if (byId.has(pred.prediction_id)) continue;
    const row: PredictionCase = {
      prediction_id: pred.prediction_id,
      event_id: pred.event_id,
      market: pred.market,
      selection: pred.selection ?? "UNKNOWN",
      prediction_probability:
        pred.probability_model && typeof pred.probability_model === "object"
          ? Number(
              pred.probability_model[pred.selection ?? ""] ??
                Object.values(pred.probability_model)[0] ??
                NaN,
            ) || null
          : null,
      odds_at_prediction: null,
      model_version: pred.model_version ?? null,
      prediction_timestamp: pred.timestamp,
      as_of: pred.timestamp,
      status: "OPEN",
      result: null,
      settled_at: null,
      pnl_simulated: null,
      data_quality: null,
    };
    byId.set(row.prediction_id, row);
    created += 1;
    if (input.persistNeon !== false) {
      await upsertPredictionCase({ ...row, payload: { synced: true } });
    }
  }
  savePredictionCases([...byId.values()], root);
  return { created };
}

function settleMarket(
  market: string,
  selection: string,
  home: number,
  away: number,
): PredictionCaseStatus | null {
  const m = market.toUpperCase();
  const sel = selection.toUpperCase();
  const total = home + away;
  const oneX2 = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";

  if (m === "1X2" || m === "H2H" || m === "MATCH_ODDS") {
    if (sel === oneX2 || sel === (oneX2 === "HOME" ? "1" : oneX2 === "AWAY" ? "2" : "X")) return "WON";
    return "LOST";
  }
  if (m === "DOUBLE_CHANCE" || m === "DC") {
    if (sel.includes("1X") || sel === "HOME_OR_DRAW") return oneX2 === "AWAY" ? "LOST" : "WON";
    if (sel.includes("X2") || sel === "DRAW_OR_AWAY") return oneX2 === "HOME" ? "LOST" : "WON";
    if (sel.includes("12") || sel === "HOME_OR_AWAY") return oneX2 === "DRAW" ? "LOST" : "WON";
  }
  if (m.includes("BTTS") || m === "BOTH_TEAMS_TO_SCORE") {
    const yes = home > 0 && away > 0;
    if (sel === "YES" || sel === "BTTS_YES") return yes ? "WON" : "LOST";
    if (sel === "NO" || sel === "BTTS_NO") return yes ? "LOST" : "WON";
  }
  if (m.includes("OVER") || m.includes("UNDER") || m.includes("TOTALS") || m.includes("OU")) {
    const lineMatch = `${m} ${sel}`.match(/(\d+(?:\.\d+)?)/);
    const line = lineMatch ? Number(lineMatch[1]) : NaN;
    if (!Number.isFinite(line)) return null;
    const isOver = /OVER|O\s/.test(`${m} ${sel}`);
    const isUnder = /UNDER|U\s/.test(`${m} ${sel}`);
    if (total === line) return "PUSH";
    if (isOver) return total > line ? "WON" : "LOST";
    if (isUnder) return total < line ? "WON" : "LOST";
  }
  if (m === "DNB" || m === "DRAW_NO_BET") {
    if (oneX2 === "DRAW") return "PUSH";
    if (sel === "HOME" || sel === "1") return oneX2 === "HOME" ? "WON" : "LOST";
    if (sel === "AWAY" || sel === "2") return oneX2 === "AWAY" ? "WON" : "LOST";
  }
  return null;
}

function simulatedPnl(
  status: PredictionCaseStatus,
  odds: number | null,
): number | null {
  if (status === "PUSH" || status === "VOID" || status === "CANCELLED") return 0;
  if (odds == null || !(odds > 1)) return null;
  if (status === "WON") return odds - 1;
  if (status === "LOST") return -1;
  return null;
}

export async function settleOpenPredictionCases(input: {
  event_id: string;
  home_score: number;
  away_score: number;
  result_label: string;
  one_x2: string;
  settled_at: string;
  source: string;
  persistNeon?: boolean;
  labBRoot?: string;
}): Promise<number> {
  const root = input.labBRoot ?? permanentRoot044();
  const cases = loadPredictionCases(root);
  let updated = 0;
  for (const c of cases) {
    if (c.event_id !== input.event_id) continue;
    if (["WON", "LOST", "VOID", "PUSH", "CANCELLED"].includes(c.status)) continue;
    const status = settleMarket(c.market, c.selection, input.home_score, input.away_score);
    if (!status) continue;
    c.status = status;
    c.result = `${input.result_label}|${input.one_x2}`;
    c.settled_at = input.settled_at;
    c.pnl_simulated = simulatedPnl(status, c.odds_at_prediction);
    updated += 1;
    if (input.persistNeon !== false) {
      await upsertPredictionCase({
        ...c,
        payload: { settle_source: input.source },
      });
    }
  }
  savePredictionCases(cases, root);
  return updated;
}
