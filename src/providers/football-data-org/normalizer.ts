import type {
  NormalizedBatch,
  NormalizedCompetition,
  NormalizedEvent,
  NormalizedTeam,
  ProviderFetchKind,
} from "@/providers/types";

const ALLOWED_CODES = new Set(["PL", "SA"]);
const ALLOWED_IDS = new Set(["2021", "2019", "PL", "SA"]);

function isAllowedCompetition(code: string | null, providerEntityId: string): boolean {
  return ALLOWED_CODES.has(code ?? "") || ALLOWED_IDS.has(providerEntityId);
}

function publishedAt(record: Record<string, unknown> | null): Date | null {
  const raw = text(record?.lastUpdated);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

function competitionFrom(value: unknown): NormalizedCompetition | null {
  const record = asRecord(value);
  const providerEntityId = id(record?.id);
  const name = text(record?.name);
  const code = text(record?.code);
  if (!providerEntityId || !name) {
    return null;
  }
  if (!isAllowedCompetition(code, providerEntityId)) {
    return null;
  }
  const area = asRecord(record?.area);
  const season = asRecord(record?.currentSeason) ?? asRecord(record?.season);
  return {
    providerEntityId,
    name,
    country: text(area?.name),
    season: text(season?.startDate)?.slice(0, 4) ?? null,
    sourcePublishedAt: publishedAt(record),
  };
}

function teamFrom(value: unknown): NormalizedTeam | null {
  const record = asRecord(value);
  const providerEntityId = id(record?.id);
  const name = text(record?.name);
  if (!providerEntityId || !name) {
    return null;
  }
  const area = asRecord(record?.area);
  return {
    providerEntityId,
    name,
    country: text(area?.name) ?? text(record?.country),
    sourcePublishedAt: publishedAt(record),
  };
}

export function normalizeFootballDataOrg(
  kind: ProviderFetchKind,
  payload: unknown,
): NormalizedBatch {
  const empty: NormalizedBatch = { competitions: [], teams: [], events: [] };
  const root = asRecord(payload);

  if (kind === "leagues") {
    const rows = asArray(root?.competitions);
    const single = competitionFrom(root);
    return {
      ...empty,
      competitions: [
        ...(single ? [single] : []),
        ...rows.flatMap((row) => {
          const item = competitionFrom(row);
          return item ? [item] : [];
        }),
      ],
    };
  }

  if (kind === "teams") {
    const embedded = competitionFrom(root?.competition);
    return {
      competitions: embedded ? [embedded] : [],
      teams: asArray(root?.teams).flatMap((row) => {
        const item = teamFrom(row);
        return item ? [item] : [];
      }),
      events: [],
    };
  }

  const events: NormalizedEvent[] = asArray(root?.matches).flatMap((row) => {
    const record = asRecord(row);
    const home = asRecord(record?.homeTeam);
    const away = asRecord(record?.awayTeam);
    const competition = asRecord(record?.competition);
    const providerEntityId = id(record?.id);
    const competitionProviderId = id(competition?.id);
    const homeTeamProviderId = id(home?.id);
    const awayTeamProviderId = id(away?.id);
    const utcDate = text(record?.utcDate);
    if (
      !providerEntityId ||
      !competitionProviderId ||
      !homeTeamProviderId ||
      !awayTeamProviderId ||
      !utcDate
    ) {
      return [];
    }
    const scheduledStartAt = new Date(utcDate);
    if (Number.isNaN(scheduledStartAt.getTime())) {
      return [];
    }
    if (!isAllowedCompetition(text(competition?.code), competitionProviderId)) {
      return [];
    }
    return [
      {
        providerEntityId,
        competitionProviderId,
        homeTeamProviderId,
        awayTeamProviderId,
        scheduledStartAt,
        status: text(record?.status) ?? "SCHEDULED",
        sourcePublishedAt: publishedAt(record),
      },
    ];
  });

  return {
    competitions: asArray(root?.matches)
      .map((row) => competitionFrom(asRecord(row)?.competition))
      .filter((item): item is NormalizedCompetition => item !== null),
    teams: asArray(root?.matches).flatMap((row) => {
      const record = asRecord(row);
      return [teamFrom(record?.homeTeam), teamFrom(record?.awayTeam)].filter(
        (item): item is NormalizedTeam => item !== null,
      );
    }),
    events,
  };
}

export class FootballDataOrgNormalizer {
  normalize(kind: ProviderFetchKind, payload: unknown): NormalizedBatch {
    return normalizeFootballDataOrg(kind, payload);
  }
}
