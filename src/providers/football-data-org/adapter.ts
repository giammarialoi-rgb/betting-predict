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
import { FootballDataOrgNormalizer } from "./normalizer";

export const FOOTBALL_DATA_ORG_PROVIDER_ID = "football-data-org";
export const FOOTBALL_DATA_ORG_COMPETITIONS = ["PL", "SA"] as const;

export function getFootballDataOrgToken(): string | undefined {
  const token = process.env.FOOTBALL_DATA_ORG_TOKEN;
  return token && token.length > 0 ? token : undefined;
}

export function getFootballDataOrgBaseUrl(): string {
  return (
    process.env.FOOTBALL_DATA_ORG_BASE_URL ?? "https://api.football-data.org/v4"
  );
}

type FootballDataOrgDeps = {
  fetch?: typeof fetch;
  token?: string;
  minIntervalMs?: number;
  baseUrl?: string;
};

export class FootballDataOrgProvider implements SportsDataProvider {
  readonly id = FOOTBALL_DATA_ORG_PROVIDER_ID;
  readonly name = "football-data.org";
  readonly capabilities = ["health", "leagues", "teams", "fixtures"] as const;
  readonly minIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenOverride?: string;
  private readonly baseUrlOverride?: string;

  constructor(deps: FootballDataOrgDeps = {}) {
    this.fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
    this.tokenOverride = deps.token;
    this.baseUrlOverride = deps.baseUrl;
    this.minIntervalMs =
      deps.minIntervalMs ??
      getMinIntervalMs(process.env.FOOTBALL_DATA_ORG_MIN_INTERVAL_MS, 7000);
  }

  private token(): string | undefined {
    if (this.tokenOverride !== undefined) {
      return this.tokenOverride.length > 0 ? this.tokenOverride : undefined;
    }
    return getFootballDataOrgToken();
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.token()) {
      return {
        ok: false,
        message: "FOOTBALL_DATA_ORG_TOKEN is not set",
      };
    }
    return { ok: true, message: "configured" };
  }

  async fetch(req: ProviderFetchRequest): Promise<ProviderFetchResult> {
    const token = this.token();
    if (!token) {
      throw new PermanentError("FOOTBALL_DATA_ORG_TOKEN is not set");
    }

    const url = buildUrl(req, this.baseUrlOverride);
    const timeoutMs = getTimeoutMs(process.env.INGEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          "X-Auth-Token": token,
        },
        signal: controller.signal,
      });

      const classification = classifyHttpStatus(response.status);
      if (classification === "retryable") {
        throw new RetryableError(
          `football-data.org HTTP ${response.status}`,
          response.status,
        );
      }
      if (classification === "permanent") {
        throw new PermanentError(
          `football-data.org HTTP ${response.status}`,
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new PermanentError("malformed JSON from football-data.org");
      }

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
    return new FootballDataOrgNormalizer().normalize(kind, payload);
  }
}

function buildUrl(req: ProviderFetchRequest, baseUrl?: string): URL {
  const base = (baseUrl ?? getFootballDataOrgBaseUrl()).replace(/\/$/, "");
  if (req.kind === "leagues") {
    return new URL(`${base}/competitions`);
  }
  if (req.kind === "teams") {
    const code = req.params?.competition ?? "PL";
    return new URL(`${base}/competitions/${code}/teams`);
  }

  const url = new URL(`${base}/matches`);
  url.searchParams.set(
    "competitions",
    req.params?.competitions ?? FOOTBALL_DATA_ORG_COMPETITIONS.join(","),
  );
  if (req.params?.dateFrom) {
    url.searchParams.set("dateFrom", req.params.dateFrom);
  }
  if (req.params?.dateTo) {
    url.searchParams.set("dateTo", req.params.dateTo);
  }
  return url;
}

export function footballDataOrgIngestRequests(): ProviderFetchRequest[] {
  const today = new Date();
  const dateFrom = today.toISOString().slice(0, 10);
  const dateTo = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return [
    { kind: "leagues" },
    { kind: "teams", params: { competition: "PL" } },
    { kind: "teams", params: { competition: "SA" } },
    {
      kind: "fixtures",
      params: {
        competitions: FOOTBALL_DATA_ORG_COMPETITIONS.join(","),
        dateFrom,
        dateTo,
      },
    },
  ];
}
