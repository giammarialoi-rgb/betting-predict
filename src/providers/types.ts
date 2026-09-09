export type ProviderCapability = "health" | "leagues" | "teams" | "fixtures";

export type ProviderFetchKind = "leagues" | "teams" | "fixtures";

export interface ProviderFetchRequest {
  kind: ProviderFetchKind;
  params?: Record<string, string>;
}

export interface ProviderFetchResult {
  endpoint: string;
  httpStatus: number;
  fetchedAt: Date;
  sourcePublishedAt: Date | null;
  payload: unknown;
}

export interface ProviderHealth {
  ok: boolean;
  message: string;
}

export interface NormalizedCompetition {
  providerEntityId: string;
  name: string;
  country: string | null;
  season: string | null;
  sourcePublishedAt?: Date | null;
}

export interface NormalizedTeam {
  providerEntityId: string;
  name: string;
  country: string | null;
  sourcePublishedAt?: Date | null;
}

export interface NormalizedEvent {
  providerEntityId: string;
  competitionProviderId: string;
  homeTeamProviderId: string;
  awayTeamProviderId: string;
  scheduledStartAt: Date;
  status: string;
  sourcePublishedAt?: Date | null;
}

export interface NormalizedBatch {
  competitions: NormalizedCompetition[];
  teams: NormalizedTeam[];
  events: NormalizedEvent[];
}

export interface SportsDataProvider {
  id: string;
  name: string;
  capabilities: readonly ProviderCapability[];
  /** Provider-specific spacing. The core does not hardcode 10 req/min. */
  minIntervalMs?: number;
  healthCheck(): Promise<ProviderHealth>;
  fetch(req: ProviderFetchRequest): Promise<ProviderFetchResult>;
  normalize(kind: ProviderFetchKind, payload: unknown): NormalizedBatch;
}
