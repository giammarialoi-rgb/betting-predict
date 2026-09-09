/**
 * HTTP client for API-Sports — budget-aware, never logs API keys.
 */

import {
  API_SPORTS_MIN_INTERVAL_MS_057,
  API_SPORTS_TIMEOUT_MS_057,
  getApiSportsBaseUrl057,
  getApiSportsKey057,
  redactSecrets057,
  apiSportsRoot057,
} from "@/domain/data-sources/api-sports/config";
import { canSpend057, loadBudget057, recordSpend057, saveBudget057 } from "@/domain/data-sources/api-sports/budget";
import { readCache057, writeCache057 } from "@/domain/data-sources/api-sports/cache";

export type ApiSportsHttpResult057 = {
  ok: boolean;
  http_status: number | null;
  path: string;
  body: unknown;
  from_cache: boolean;
  error: string | null;
  requests_charged: number;
  errors_api: string[];
};

let lastCallAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function extractApiErrors(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const e = (body as { errors?: unknown }).errors;
  if (!e) return [];
  if (Array.isArray(e)) return e.map(String);
  if (typeof e === "object") return Object.entries(e as Record<string, unknown>).map(([k, v]) => `${k}:${String(v)}`);
  return [String(e)];
}

export async function apiSportsGet057(
  pathWithQuery: string,
  opts: {
    useCacheMs?: number;
    charge?: boolean;
    forceNetwork?: boolean;
  } = {},
): Promise<ApiSportsHttpResult057> {
  const root = apiSportsRoot057();
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const useCacheMs = opts.useCacheMs ?? 6 * 3600_000;

  if (!opts.forceNetwork && useCacheMs > 0) {
    const c = readCache057(path, useCacheMs, root);
    if (c.hit) {
      return {
        ok: true,
        http_status: 200,
        path,
        body: c.body,
        from_cache: true,
        error: null,
        requests_charged: 0,
        errors_api: extractApiErrors(c.body),
      };
    }
  }

  const key = getApiSportsKey057();
  if (!key) {
    return {
      ok: false,
      http_status: null,
      path,
      body: null,
      from_cache: false,
      error: "API_KEY_NOT_CONFIGURED",
      requests_charged: 0,
      errors_api: [],
    };
  }

  if (opts.charge !== false) {
    const spend = canSpend057(1, root);
    if (!spend.ok) {
      return {
        ok: false,
        http_status: null,
        path,
        body: null,
        from_cache: false,
        error: spend.reason,
        requests_charged: 0,
        errors_api: [],
      };
    }
  }

  const wait = API_SPORTS_MIN_INTERVAL_MS_057 - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);

  const url = `${getApiSportsBaseUrl057().replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_SPORTS_TIMEOUT_MS_057);

  try {
    lastCallAt = Date.now();
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": key,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (opts.charge !== false) {
      let planName: string | null = null;
      let remoteUsed: number | null = null;
      if (body && typeof body === "object") {
        const response = (body as { response?: Record<string, unknown> }).response;
        if (response && typeof response === "object") {
          const sub = response.subscription as { plan?: string } | undefined;
          planName = sub?.plan ?? null;
          const reqs = response.requests as { current?: number; limit_day?: number } | undefined;
          if (typeof reqs?.current === "number") remoteUsed = reqs.current;
        }
      }
      recordSpend057(1, { plan: planName }, root);
      if (remoteUsed != null && path.startsWith("/status")) {
        const b = loadBudget057(root);
        // Prefer remote counter when higher (provider is source of truth for day usage)
        if (remoteUsed > b.used_day) {
          saveBudget057(
            {
              ...b,
              used_day: remoteUsed,
              remaining_day: Math.max(0, b.limit_day - remoteUsed),
              plan: planName ?? b.plan,
            },
            root,
          );
        }
      }
    }

    const errors = extractApiErrors(body);
    const planLimited = errors.some((x) => /plan|subscription|not available|upgrade/i.test(x));
    const rateLimited = res.status === 429 || errors.some((x) => /rate/i.test(x));

    if (res.ok && body != null) {
      writeCache057(path, body, root);
    }

    return {
      ok: res.ok && !rateLimited,
      http_status: res.status,
      path,
      body,
      from_cache: false,
      error: rateLimited
        ? "RATE_LIMITED"
        : planLimited
          ? "PLAN_LIMITED"
          : res.ok
            ? errors.length
              ? redactSecrets057(errors.join("; "))
              : null
            : `HTTP_${res.status}`,
      requests_charged: opts.charge === false ? 0 : 1,
      errors_api: errors.map(redactSecrets057),
    };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      http_status: null,
      path,
      body: null,
      from_cache: false,
      error: redactSecrets057(aborted ? "TIMEOUT" : msg),
      requests_charged: 0,
      errors_api: [],
    };
  }
}

export function budgetSnapshot057() {
  return loadBudget057();
}
