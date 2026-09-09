/**
 * API-Sports daily/minute budget governor.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  API_SPORTS_LIMIT_DAY_057,
  API_SPORTS_LIMIT_MINUTE_057,
  apiSportsRoot057,
} from "@/domain/data-sources/api-sports/config";
import type { ApiSportsBudgetState057 } from "@/domain/data-sources/api-sports/types";

type MinuteBucket = { minute: string; count: number };

function dayUtc(iso = new Date().toISOString()): string {
  return iso.slice(0, 10);
}

function minuteUtc(iso = new Date().toISOString()): string {
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
}

export function loadBudget057(root = apiSportsRoot057()): ApiSportsBudgetState057 & { _minute?: MinuteBucket } {
  mkdirSync(root, { recursive: true });
  const p = join(root, "request-budget.json");
  const now = new Date().toISOString();
  const empty: ApiSportsBudgetState057 & { _minute?: MinuteBucket } = {
    at: now,
    day_utc: dayUtc(now),
    limit_day: API_SPORTS_LIMIT_DAY_057,
    limit_minute: API_SPORTS_LIMIT_MINUTE_057,
    used_day: 0,
    remaining_day: API_SPORTS_LIMIT_DAY_057,
    used_minute: 0,
    last_request_at: null,
    plan: null,
    source: "API_SPORTS",
    real_money: false,
    open_task_058: false,
    _minute: { minute: minuteUtc(now), count: 0 },
  };
  if (!existsSync(p)) return empty;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as ApiSportsBudgetState057 & {
      _minute?: MinuteBucket;
    };
    if (raw.day_utc !== dayUtc(now)) {
      return { ...empty, plan: raw.plan ?? null };
    }
    const min = raw._minute?.minute === minuteUtc(now) ? raw._minute : { minute: minuteUtc(now), count: 0 };
    return {
      ...empty,
      ...raw,
      day_utc: dayUtc(now),
      remaining_day: Math.max(0, (raw.limit_day ?? API_SPORTS_LIMIT_DAY_057) - (raw.used_day ?? 0)),
      used_minute: min.count,
      _minute: min,
      real_money: false,
      open_task_058: false,
    };
  } catch {
    return empty;
  }
}

export function saveBudget057(
  state: ApiSportsBudgetState057 & { _minute?: MinuteBucket },
  root = apiSportsRoot057(),
): void {
  mkdirSync(root, { recursive: true });
  const out = {
    ...state,
    at: new Date().toISOString(),
    remaining_day: Math.max(0, state.limit_day - state.used_day),
    used_minute: state._minute?.count ?? state.used_minute,
    real_money: false as const,
    open_task_058: false as const,
  };
  writeFileSync(join(root, "request-budget.json"), JSON.stringify(out, null, 2));
}

export function canSpend057(n = 1, root = apiSportsRoot057()): { ok: boolean; reason: string | null } {
  const b = loadBudget057(root);
  if (b.used_day + n > b.limit_day) return { ok: false, reason: "DAY_BUDGET_EXHAUSTED" };
  const min = b._minute ?? { minute: minuteUtc(), count: 0 };
  if (min.count + n > b.limit_minute) return { ok: false, reason: "MINUTE_RATE_LIMIT" };
  return { ok: true, reason: null };
}

export function recordSpend057(
  n: number,
  extra: { plan?: string | null } = {},
  root = apiSportsRoot057(),
): ApiSportsBudgetState057 {
  const b = loadBudget057(root);
  const now = new Date().toISOString();
  let min = b._minute ?? { minute: minuteUtc(now), count: 0 };
  if (min.minute !== minuteUtc(now)) min = { minute: minuteUtc(now), count: 0 };
  min = { ...min, count: min.count + n };
  const next = {
    ...b,
    used_day: b.used_day + n,
    remaining_day: Math.max(0, b.limit_day - (b.used_day + n)),
    used_minute: min.count,
    last_request_at: now,
    plan: extra.plan !== undefined ? extra.plan : b.plan,
    _minute: min,
  };
  saveBudget057(next, root);
  const { _minute: _, ...pub } = next;
  return pub;
}
