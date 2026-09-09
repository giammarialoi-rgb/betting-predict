export const IMPLEMENTED_PROVIDER_IDS = [
  "api-football",
  "football-data-org",
  "mock",
] as const;

export const TECHNICAL_PROVIDER_IDS = ["mock"] as const;

export type LicenseClass =
  | "official_api"
  | "public_endpoint"
  | "dataset"
  | "website"
  | "scraping_candidate"
  | "license_sensitive"
  | "unknown";

/** SportDefinition.id maps 1:1 to sports.slug. No aliases. */
export function sportSlugFromCatalog(sportId: string): string {
  return sportId;
}

export function isTechnicalProvider(providerId: string): boolean {
  return (TECHNICAL_PROVIDER_IDS as readonly string[]).includes(providerId);
}

export function licenseClassForProvider(providerId: string): LicenseClass {
  if (providerId === "api-football" || providerId === "football-data-org") {
    return "official_api";
  }
  return "unknown";
}
