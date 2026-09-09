import assert from "node:assert/strict";
import { config } from "dotenv";
import { count, eq } from "drizzle-orm";
import { describe, it } from "node:test";
import { getDb } from "../db/client";
import { dataSources, sports } from "../db/schema";
import { getSource, listSources } from "./sources/catalog";
import { listSports } from "./sports/catalog";
import {
  assertNotAProvider,
  collectStaticAlignmentIssues,
  sportSlugFromCatalog,
} from "./alignment";
import {
  IMPLEMENTED_PROVIDER_IDS,
  TECHNICAL_PROVIDER_IDS,
} from "./alignment-ids";
import { bootstrapImplementedProviders } from "../ingest/bootstrap";
import {
  getProvider,
  listProviders,
  resetRegistry,
} from "../ingest/registry";
import { seedOperationalCatalog } from "../ingest/seed";
import { API_FOOTBALL_PROVIDER_ID } from "../providers/api-football/adapter";
import { FOOTBALL_DATA_ORG_PROVIDER_ID } from "../providers/football-data-org/adapter";
import { MOCK_PROVIDER_ID } from "../providers/mock/adapter";

config({ path: ".env.local" });
config({ path: ".env" });

describe("catalog to database alignment", () => {
  it("maps every catalog sport id 1:1 to a slug", () => {
    for (const sport of listSports()) {
      assert.match(sport.id, /^[a-z0-9-]+$/);
      assert.equal(sportSlugFromCatalog(sport.id), sport.id);
    }
  });

  it("keeps implemented providers aligned with the catalog", () => {
    assert.deepEqual(
      [...IMPLEMENTED_PROVIDER_IDS],
      ["api-football", "football-data-org", "mock"],
    );
    assert.equal(API_FOOTBALL_PROVIDER_ID, "api-football");
    assert.equal(FOOTBALL_DATA_ORG_PROVIDER_ID, "football-data-org");
    assert.equal(MOCK_PROVIDER_ID, "mock");
    assert.equal(getSource("api-football")?.id, "api-football");
    assert.equal(getSource("football-data-org")?.id, "football-data-org");
    assert.equal(getSource("mock"), undefined);
    assert.deepEqual([...TECHNICAL_PROVIDER_IDS], ["mock"]);
    assert.deepEqual(collectStaticAlignmentIssues(), []);
  });

  it("does not register catalog-only sources as providers", () => {
    resetRegistry();
    bootstrapImplementedProviders();
    const providerIds = listProviders().map((item) => item.id).sort();
    assert.deepEqual(providerIds, [
      "api-football",
      "football-data-org",
      "mock",
    ]);
    assert.throws(() => getProvider("fbref"), /Unknown provider: fbref/);
    assert.doesNotThrow(() => assertNotAProvider("fbref"));
    assert.ok(listSources().some((item) => item.id === "fbref"));
    resetRegistry();
  });

  it("seeds sports and implemented data sources idempotently", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    await seedOperationalCatalog();
    await seedOperationalCatalog();

    const db = getDb();
    for (const sport of listSports()) {
      const [row] = await db
        .select({ value: count() })
        .from(sports)
        .where(eq(sports.slug, sport.id));
      assert.equal(row.value, 1, sport.id);
    }

    const [footballSources] = await db
      .select({ value: count() })
      .from(dataSources)
      .where(eq(dataSources.slug, "api-football"));
    const [fdSources] = await db
      .select({ value: count() })
      .from(dataSources)
      .where(eq(dataSources.slug, "football-data-org"));
    const [mockSources] = await db
      .select({ value: count() })
      .from(dataSources)
      .where(eq(dataSources.slug, "mock"));
    const [fbref] = await db
      .select({ value: count() })
      .from(dataSources)
      .where(eq(dataSources.slug, "fbref"));

    assert.equal(footballSources.value, 1);
    assert.equal(fdSources.value, 1);
    assert.equal(mockSources.value, 1);
    assert.equal(fbref.value, 0);

    const [apiRow] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, "api-football"));
    const [fdRow] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, "football-data-org"));
    assert.equal(apiRow.reliabilityScore, null);
    assert.equal(fdRow.reliabilityScore, null);
  });
});
