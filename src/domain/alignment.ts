import { getSource } from "@/domain/sources/catalog";
import { listSports } from "@/domain/sports/catalog";
import { getProvider, listProviders } from "@/ingest/registry";
import { getDataSourceBySlug, getSportBySlug } from "@/ingest/seed";
import {
  TECHNICAL_PROVIDER_IDS,
  sportSlugFromCatalog,
} from "@/domain/alignment-ids";

export {
  IMPLEMENTED_PROVIDER_IDS,
  TECHNICAL_PROVIDER_IDS,
  isTechnicalProvider,
  licenseClassForProvider,
  sportSlugFromCatalog,
  type LicenseClass,
} from "@/domain/alignment-ids";

export type AlignmentIssue = {
  code:
    | "missing_db_sport"
    | "missing_data_source"
    | "technical_provider_in_catalog";
  message: string;
};

export function collectStaticAlignmentIssues(): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];

  for (const id of TECHNICAL_PROVIDER_IDS) {
    if (getSource(id)) {
      issues.push({
        code: "technical_provider_in_catalog",
        message: `Technical provider "${id}" must not be a SourceDefinition`,
      });
    }
  }

  return issues;
}

export async function collectDatabaseAlignmentIssues(): Promise<
  AlignmentIssue[]
> {
  const issues = [...collectStaticAlignmentIssues()];

  for (const sport of listSports()) {
    const slug = sportSlugFromCatalog(sport.id);
    const row = await getSportBySlug(slug);
    if (!row) {
      issues.push({
        code: "missing_db_sport",
        message: `Catalog sport "${sport.id}" is missing from database sports.slug. Run seed, do not invent aliases.`,
      });
    }
  }

  for (const provider of listProviders()) {
    const row = await getDataSourceBySlug(provider.id);
    if (!row) {
      issues.push({
        code: "missing_data_source",
        message: `Registered provider "${provider.id}" has no data_sources.slug. Seed implemented providers only.`,
      });
    }
  }

  return issues;
}

export function assertNotAProvider(sourceId: string): void {
  try {
    getProvider(sourceId);
  } catch {
    return;
  }
  throw new Error(
    `Source "${sourceId}" is registered as a SportsDataProvider but has no adapter. Source ≠ provider.`,
  );
}

export async function assertCatalogDatabaseAlignment(): Promise<void> {
  const issues = await collectDatabaseAlignmentIssues();
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("\n"));
  }
}
