import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataSources, sports } from "@/db/schema";
import { listSports } from "@/domain/sports/catalog";
import { getSource } from "@/domain/sources/catalog";
import {
  IMPLEMENTED_PROVIDER_IDS,
  TECHNICAL_PROVIDER_IDS,
  licenseClassForProvider,
} from "@/domain/alignment-ids";
import { API_FOOTBALL_PROVIDER_ID } from "@/providers/api-football/adapter";
import { MOCK_PROVIDER_ID } from "@/providers/mock/adapter";

export async function seedSportsFromCatalog() {
  const db = getDb();
  for (const sport of listSports()) {
    await db
      .insert(sports)
      .values({ slug: sport.id, name: sport.name })
      .onConflictDoNothing({ target: sports.slug });
  }
}

export async function seedImplementedDataSources() {
  const db = getDb();

  for (const providerId of IMPLEMENTED_PROVIDER_IDS) {
    const metadata = getSource(providerId);
    const isTechnical = (TECHNICAL_PROVIDER_IDS as readonly string[]).includes(
      providerId,
    );
    const name = isTechnical
      ? "Mock Sports Provider (technical)"
      : (metadata?.name ?? providerId);

    await db
      .insert(dataSources)
      .values({
        slug: providerId,
        name,
        licenseClass: licenseClassForProvider(providerId),
        reliabilityScore: null,
      })
      .onConflictDoNothing({ target: dataSources.slug });
  }
}

export async function seedOperationalCatalog() {
  await seedSportsFromCatalog();
  await seedImplementedDataSources();
}

export async function getSportBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(sports).where(eq(sports.slug, slug));
  return row ?? null;
}

export async function getDataSourceBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.slug, slug));
  return row ?? null;
}

export { API_FOOTBALL_PROVIDER_ID, MOCK_PROVIDER_ID };
