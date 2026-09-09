import type {
  NormalizedBatch,
  NormalizedCompetition,
  NormalizedEvent,
  NormalizedTeam,
  ProviderFetchKind,
} from "@/providers/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalDate(value: unknown): Date | null | undefined {
  if (value == null) {
    return value === null ? null : undefined;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizeMock(
  kind: ProviderFetchKind,
  payload: unknown,
): NormalizedBatch {
  const root = asRecord(payload);
  const empty: NormalizedBatch = { competitions: [], teams: [], events: [] };

  if (kind === "leagues") {
    return {
      ...empty,
      competitions: asArray(root?.competitions).flatMap((row) => {
        const record = asRecord(row);
        const providerEntityId = text(record?.id);
        const name = text(record?.name);
        if (!providerEntityId || !name) {
          return [];
        }
        const competition: NormalizedCompetition = {
          providerEntityId,
          name,
          country: text(record?.country),
          season: text(record?.season),
          sourcePublishedAt: optionalDate(record?.sourcePublishedAt),
        };
        return [competition];
      }),
    };
  }

  if (kind === "teams") {
    return {
      ...empty,
      teams: asArray(root?.teams).flatMap((row) => {
        const record = asRecord(row);
        const providerEntityId = text(record?.id);
        const name = text(record?.name);
        if (!providerEntityId || !name) {
          return [];
        }
        const team: NormalizedTeam = {
          providerEntityId,
          name,
          country: text(record?.country),
          sourcePublishedAt: optionalDate(record?.sourcePublishedAt),
        };
        return [team];
      }),
    };
  }

  return {
    ...empty,
    events: asArray(root?.events).flatMap((row) => {
      const record = asRecord(row);
      const providerEntityId = text(record?.id);
      const competitionProviderId = text(record?.competitionId);
      const homeTeamProviderId = text(record?.homeTeamId);
      const awayTeamProviderId = text(record?.awayTeamId);
      const scheduled = text(record?.scheduledStartAt);
      if (
        !providerEntityId ||
        !competitionProviderId ||
        !homeTeamProviderId ||
        !awayTeamProviderId ||
        !scheduled
      ) {
        return [];
      }
      const scheduledStartAt = new Date(scheduled);
      if (Number.isNaN(scheduledStartAt.getTime())) {
        return [];
      }
      const event: NormalizedEvent = {
        providerEntityId,
        competitionProviderId,
        homeTeamProviderId,
        awayTeamProviderId,
        scheduledStartAt,
        status: text(record?.status) ?? "NS",
        sourcePublishedAt: optionalDate(record?.sourcePublishedAt),
      };
      return [event];
    }),
  };
}
