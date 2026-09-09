import type {
  NormalizedBatch,
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

function id(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return text(value);
}

export function normalizeApiFootball(
  kind: ProviderFetchKind,
  payload: unknown,
): NormalizedBatch {
  const empty: NormalizedBatch = { competitions: [], teams: [], events: [] };
  const root = asRecord(payload);
  const rows = asArray(root?.response);

  if (kind === "leagues") {
    return {
      ...empty,
      competitions: rows.flatMap((row) => {
        const record = asRecord(row);
        const league = asRecord(record?.league);
        const country = asRecord(record?.country);
        const seasons = asArray(record?.seasons);
        const current = seasons
          .map((season) => asRecord(season))
          .find((season) => season?.current === true);
        const providerEntityId = id(league?.id);
        const name = text(league?.name);
        if (!providerEntityId || !name) {
          return [];
        }
        return [
          {
            providerEntityId,
            name,
            country: text(country?.name) ?? text(league?.country),
            season: id(current?.year) ?? id(league?.season),
          },
        ];
      }),
    };
  }

  if (kind === "teams") {
    return {
      ...empty,
      teams: rows.flatMap((row) => {
        const team = asRecord(asRecord(row)?.team);
        const providerEntityId = id(team?.id);
        const name = text(team?.name);
        if (!providerEntityId || !name) {
          return [];
        }
        return [
          {
            providerEntityId,
            name,
            country: text(team?.country),
          },
        ];
      }),
    };
  }

  return {
    ...empty,
    events: rows.flatMap((row) => {
      const record = asRecord(row);
      const fixture = asRecord(record?.fixture);
      const league = asRecord(record?.league);
      const teams = asRecord(record?.teams);
      const home = asRecord(teams?.home);
      const away = asRecord(teams?.away);
      const status = asRecord(fixture?.status);
      const providerEntityId = id(fixture?.id);
      const competitionProviderId = id(league?.id);
      const homeTeamProviderId = id(home?.id);
      const awayTeamProviderId = id(away?.id);
      const scheduled = text(fixture?.date);
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
      return [
        {
          providerEntityId,
          competitionProviderId,
          homeTeamProviderId,
          awayTeamProviderId,
          scheduledStartAt,
          status: text(status?.short) ?? "NS",
        },
      ];
    }),
  };
}
