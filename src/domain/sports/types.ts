export const SPORT_CATEGORIES = [
  "team",
  "individual",
  "combat",
  "motorsport",
  "mixed",
] as const;

export type SportCategory = (typeof SPORT_CATEGORIES)[number];

export const EVENT_TYPES = [
  "team_vs_team",
  "individual_vs_individual",
  "individual_event",
  "race",
  "tournament",
  "match",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type SportDefinition = {
  readonly id: string;
  readonly name: string;
  readonly category: SportCategory;
  readonly eventType: EventType;
  readonly supportsTeams: boolean;
  readonly supportsPlayers: boolean;
  readonly supportsDraw: boolean;
  readonly supportsIndividualCompetitors: boolean;
};
