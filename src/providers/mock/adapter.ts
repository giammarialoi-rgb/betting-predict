import {
  agreementObservations,
  disagreementObservations,
  missingObservations,
  temporalChangeObservations,
} from "@/domain/cross-source/scenarios";
import { PermanentError, RetryableError } from "@/ingest/retry";
import type {
  ProviderFetchKind,
  ProviderFetchRequest,
  ProviderFetchResult,
  ProviderHealth,
  SportsDataProvider,
} from "@/providers/types";
import { normalizeMock } from "./normalizer";

export const MOCK_PROVIDER_ID = "mock";

export type MockFailure = "timeout" | "network" | 429 | 500 | 400;

export interface MockStep {
  kind: ProviderFetchKind;
  payload: unknown;
  sourcePublishedAt?: Date | null;
  failure?: MockFailure;
  failuresRemaining?: number;
}

export class MockSportsProvider implements SportsDataProvider {
  readonly id = MOCK_PROVIDER_ID;
  readonly name = "Mock Sports Provider";
  readonly capabilities = ["health", "leagues", "teams", "fixtures"] as const;
  readonly minIntervalMs = 0;
  private readonly queue: MockStep[];

  constructor(steps: MockStep[] = defaultMockSteps()) {
    this.queue = [...steps];
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, message: "mock ready" };
  }

  async fetch(req: ProviderFetchRequest): Promise<ProviderFetchResult> {
    const index = this.queue.findIndex((step) => step.kind === req.kind);
    const step = index >= 0 ? this.queue[index] : undefined;
    if (index >= 0) {
      this.queue.splice(index, 1);
    }

    if (!step) {
      return {
        endpoint: req.kind,
        httpStatus: 200,
        fetchedAt: new Date(),
        sourcePublishedAt: null,
        payload: {},
      };
    }

    if (step.failure && (step.failuresRemaining ?? 1) > 0) {
      if (step.failuresRemaining != null) {
        step.failuresRemaining -= 1;
        if (step.failuresRemaining > 0 || step.failuresRemaining === 0) {
          this.queue.unshift(step);
        }
      }
      throwFailure(step.failure);
    }

    return {
      endpoint: req.kind,
      httpStatus: 200,
      fetchedAt: new Date(),
      sourcePublishedAt: step.sourcePublishedAt ?? null,
      payload: step.payload,
    };
  }

  normalize(kind: ProviderFetchKind, payload: unknown) {
    return normalizeMock(kind, payload);
  }
}

function throwFailure(failure: MockFailure): never {
  if (failure === "timeout") {
    throw new RetryableError("timeout");
  }
  if (failure === "network") {
    throw new RetryableError("network error");
  }
  if (failure === 429 || failure === 500) {
    throw new RetryableError(`HTTP ${failure}`, failure);
  }
  throw new PermanentError(`HTTP ${failure}`, failure);
}

export function defaultMockSteps(): MockStep[] {
  const t1 = new Date("2026-09-06T12:00:00.000Z");
  const t2 = new Date("2026-09-06T13:00:00.000Z");
  return [
    {
      kind: "leagues",
      sourcePublishedAt: t1,
      payload: {
        competitions: [
          {
            id: "mock-league-1",
            name: "Mock Premier League",
            country: "England",
            season: "2026",
            sourcePublishedAt: t1.toISOString(),
          },
        ],
      },
    },
    {
      kind: "teams",
      sourcePublishedAt: t1,
      payload: {
        teams: [
          {
            id: "mock-team-home",
            name: "Mock United",
            country: "England",
            sourcePublishedAt: t1.toISOString(),
          },
          {
            id: "mock-team-away",
            name: "Mock City",
            country: "England",
            sourcePublishedAt: t1.toISOString(),
          },
        ],
      },
    },
    {
      kind: "fixtures",
      sourcePublishedAt: t2,
      payload: {
        events: [
          {
            id: "mock-event-a",
            competitionId: "mock-league-1",
            homeTeamId: "mock-team-home",
            awayTeamId: "mock-team-away",
            scheduledStartAt: "2026-09-06T16:00:00.000Z",
            status: "NS",
            sourcePublishedAt: t1.toISOString(),
          },
          {
            id: "mock-event-b",
            competitionId: "mock-league-1",
            homeTeamId: "mock-team-away",
            awayTeamId: "mock-team-home",
            scheduledStartAt: "2026-09-06T16:00:00.000Z",
            status: "NS",
            sourcePublishedAt: t2.toISOString(),
          },
        ],
      },
    },
  ];
}

export function mockIngestRequests(): ProviderFetchRequest[] {
  return [{ kind: "leagues" }, { kind: "teams" }, { kind: "fixtures" }];
}

export { SCENARIO_TIMESTAMPS } from "@/domain/cross-source/scenarios";
export {
  agreementObservations,
  disagreementObservations,
  missingObservations,
  temporalChangeObservations,
};

export type MockCrossSourceScenario =
  | "agreement"
  | "disagreement"
  | "missing"
  | "temporal_change";

export function mockCrossSourceScenario(
  scenario: MockCrossSourceScenario,
) {
  switch (scenario) {
    case "agreement":
      return agreementObservations();
    case "disagreement":
      return disagreementObservations();
    case "missing":
      return missingObservations();
    case "temporal_change":
      return temporalChangeObservations();
  }
}
