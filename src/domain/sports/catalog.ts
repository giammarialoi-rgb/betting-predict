import { EVENT_TYPES, type EventType, type SportDefinition } from "./types";

function sport(definition: SportDefinition): SportDefinition {
  return Object.freeze(definition);
}

const SPORTS: readonly SportDefinition[] = Object.freeze([
  sport({
    id: "football",
    name: "Football",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "basketball",
    name: "Basketball",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "tennis",
    name: "Tennis",
    category: "individual",
    eventType: "individual_vs_individual",
    supportsTeams: false,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: true,
  }),
  sport({
    id: "baseball",
    name: "Baseball",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "american-football",
    name: "American Football",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "ice-hockey",
    name: "Ice Hockey",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "rugby",
    name: "Rugby",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "volleyball",
    name: "Volleyball",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "handball",
    name: "Handball",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: false,
  }),
  sport({
    id: "mma",
    name: "MMA",
    category: "combat",
    eventType: "individual_vs_individual",
    supportsTeams: false,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: true,
  }),
  sport({
    id: "boxing",
    name: "Boxing",
    category: "combat",
    eventType: "individual_vs_individual",
    supportsTeams: false,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: true,
  }),
  sport({
    id: "golf",
    name: "Golf",
    category: "individual",
    eventType: "tournament",
    supportsTeams: false,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: true,
  }),
  sport({
    id: "formula-1",
    name: "Formula 1",
    category: "motorsport",
    eventType: "race",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: false,
    supportsIndividualCompetitors: true,
  }),
  sport({
    id: "cricket",
    name: "Cricket",
    category: "team",
    eventType: "team_vs_team",
    supportsTeams: true,
    supportsPlayers: true,
    supportsDraw: true,
    supportsIndividualCompetitors: false,
  }),
]);

const SPORTS_BY_ID = new Map(SPORTS.map((item) => [item.id, item]));

export function listSports(): readonly SportDefinition[] {
  return SPORTS;
}

/** Returns the sport definition, or undefined if the id is not in the catalog. */
export function getSport(id: string): SportDefinition | undefined {
  return SPORTS_BY_ID.get(id);
}

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}
