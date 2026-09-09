export type EntityType = "competition" | "team" | "event";

export type ProviderRef = {
  source: string;
  providerEntityId: string;
};

export type EntityAlias = {
  entityType: EntityType;
  left: ProviderRef;
  right: ProviderRef;
};

/**
 * Verified, explicit aliases only. Competition codes/ids are official.
 * Team aliases are empty until a human confirms them — names are not keys.
 */
export const VERIFIED_ENTITY_ALIASES: readonly EntityAlias[] = Object.freeze([
  {
    entityType: "competition",
    left: { source: "football-data-org", providerEntityId: "PL" },
    right: { source: "football-data-org", providerEntityId: "2021" },
  },
  {
    entityType: "competition",
    left: { source: "football-data-org", providerEntityId: "SA" },
    right: { source: "football-data-org", providerEntityId: "2019" },
  },
  {
    entityType: "competition",
    left: { source: "football-data-org", providerEntityId: "2021" },
    right: { source: "api-football", providerEntityId: "39" },
  },
  {
    entityType: "competition",
    left: { source: "football-data-org", providerEntityId: "PL" },
    right: { source: "api-football", providerEntityId: "39" },
  },
  {
    entityType: "competition",
    left: { source: "football-data-org", providerEntityId: "2019" },
    right: { source: "api-football", providerEntityId: "135" },
  },
  {
    entityType: "competition",
    left: { source: "football-data-org", providerEntityId: "SA" },
    right: { source: "api-football", providerEntityId: "135" },
  },
]);

export function findAliasPartners(
  source: string,
  entityType: EntityType,
  providerEntityId: string,
  aliases: readonly EntityAlias[] = VERIFIED_ENTITY_ALIASES,
): ProviderRef[] {
  const partners: ProviderRef[] = [];
  for (const alias of aliases) {
    if (alias.entityType !== entityType) {
      continue;
    }
    if (
      alias.left.source === source &&
      alias.left.providerEntityId === providerEntityId
    ) {
      partners.push(alias.right);
    }
    if (
      alias.right.source === source &&
      alias.right.providerEntityId === providerEntityId
    ) {
      partners.push(alias.left);
    }
  }
  return partners;
}
