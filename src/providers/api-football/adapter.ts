import { getMinIntervalMs } from "@/ingest/rate-limit";
import {
  classifyHttpStatus,
  PermanentError,
  RetryableError,
  getTimeoutMs,
} from "@/ingest/retry";
import type {
  ProviderFetchKind,
  ProviderFetchRequest,
  ProviderFetchResult,
  ProviderHealth,
  SportsDataProvider,
} from "@/providers/types";
import { normalizeApiFootball } from "./normalizer";

export const API_FOOTBALL_PROVIDER_ID = "api-football";

export function getApiFootballKey(): string | undefined {
  const key = process.env.API_FOOTBALL_KEY;
  return key && key.length > 0 ? key : undefined;
}

export function getApiFootballBaseUrl(): string {
  return (
    process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io"
  );
}

function pathFor(kind: ProviderFetchKind): string {
  if (kind === "leagues") return "/leagues";
  if (kind === "teams") return "/teams";
  return "/fixtures";
}

export class ApiFootballProvider implements SportsDataProvider {
  readonly id = API_FOOTBALL_PROVIDER_ID;
  readonly name = "API-Football";
  readonly capabilities = ["health", "leagues", "teams", "fixtures"] as const;
  readonly minIntervalMs = getMinIntervalMs(process.env.API_FOOTBALL_MIN_INTERVAL_MS);

  async healthCheck(): Promise<ProviderHealth> {
    if (!getApiFootballKey()) {
      return {
        ok: false,
        message: "API_FOOTBALL_KEY is not set",
      };
    }
    return { ok: true, message: "configured" };
  }

  async fetch(req: ProviderFetchRequest): Promise<ProviderFetchResult> {
    const key = getApiFootballKey();
    if (!key) {
      throw new PermanentError("API_FOOTBALL_KEY is not set");
    }

    const url = new URL(pathFor(req.kind), getApiFootballBaseUrl());
    for (const [name, value] of Object.entries(req.params ?? {})) {
      url.searchParams.set(name, value);
    }

    const timeoutMs = getTimeoutMs(process.env.INGEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-apisports-key": key,
        },
        signal: controller.signal,
      });

      const classification = classifyHttpStatus(response.status);
      if (classification === "retryable") {
        throw new RetryableError(
          `API-Football HTTP ${response.status}`,
          response.status,
        );
      }
      if (classification === "permanent") {
        throw new PermanentError(
          `API-Football HTTP ${response.status}`,
          response.status,
        );
      }

      const payload: unknown = await response.json();
      return {
        endpoint: req.kind,
        httpStatus: response.status,
        fetchedAt: new Date(),
        sourcePublishedAt: null,
        payload,
      };
    } catch (error) {
      if (error instanceof RetryableError || error instanceof PermanentError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new RetryableError("timeout");
      }
      throw new RetryableError(
        error instanceof Error ? error.message : "network error",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  normalize(kind: ProviderFetchKind, payload: unknown) {
    return normalizeApiFootball(kind, payload);
  }
}

export function footballIngestRequests(): ProviderFetchRequest[] {
  const season = String(new Date().getUTCFullYear());
  return [
    { kind: "leagues", params: { id: "39", season } },
    { kind: "teams", params: { league: "39", season } },
    { kind: "fixtures", params: { league: "39", season, next: "10" } },
  ];
}
