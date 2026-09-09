import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, count, eq } from "drizzle-orm";
import { describe, it } from "node:test";
import { getDb } from "../db/client";
import {
  competitions,
  dataSources,
  ingestionRuns,
  sourceEntityMap,
  teams,
} from "../db/schema";
import { normalizeApiFootball } from "../providers/api-football/normalizer";
import {
  FOOTBALL_DATA_ORG_PROVIDER_ID,
  FootballDataOrgProvider,
} from "../providers/football-data-org/adapter";
import { normalizeFootballDataOrg } from "../providers/football-data-org/normalizer";
import type {
  ProviderFetchKind,
  ProviderFetchRequest,
  ProviderFetchResult,
  ProviderHealth,
  SportsDataProvider,
} from "../providers/types";
import { runIngestion } from "./engine";

config({ path: ".env.local" });
config({ path: ".env" });

class ScriptedProvider implements SportsDataProvider {
  readonly capabilities = ["health", "leagues", "teams", "fixtures"] as const;
  readonly minIntervalMs = 0;

  constructor(
    readonly id: string,
    readonly name: string,
    private readonly normalizeFn: (
      kind: ProviderFetchKind,
      payload: unknown,
    ) => ReturnType<SportsDataProvider["normalize"]>,
    private readonly payloads: Partial<Record<ProviderFetchKind, unknown>>,
  ) {}

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, message: "scripted" };
  }

  async fetch(req: ProviderFetchRequest): Promise<ProviderFetchResult> {
    return {
      endpoint: req.kind,
      httpStatus: 200,
      fetchedAt: new Date("2026-09-06T12:00:00.000Z"),
      sourcePublishedAt: null,
      payload: this.payloads[req.kind] ?? {},
    };
  }

  normalize(kind: ProviderFetchKind, payload: unknown) {
    return this.normalizeFn(kind, payload);
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("football-data.org ingestion", () => {
  it("ingests twice without canonical duplicates and keeps two audit runs", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const competitionId = `fd-idem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const payload = {
      competitions: [
        {
          id: competitionId,
          name: "Premier League",
          code: "PL",
          area: { name: "England" },
          currentSeason: { startDate: "2025-08-15" },
        },
      ],
    };
    let httpCalls = 0;
    const provider = new FootballDataOrgProvider({
      token: "test-token",
      minIntervalMs: 0,
      fetch: async () => {
        httpCalls += 1;
        return jsonResponse(payload);
      },
    });

    const first = await runIngestion({
      provider,
      requests: [{ kind: "leagues" }],
      licenseClass: "official_api",
    });
    const second = await runIngestion({
      provider,
      requests: [{ kind: "leagues" }],
      licenseClass: "official_api",
    });

    assert.equal(first.status, "succeeded");
    assert.equal(second.status, "succeeded");
    assert.notEqual(first.runId, second.runId);
    assert.ok(first.recordsStored >= 1);
    assert.equal(second.recordsStored, 0);
    assert.ok(second.recordsRejected >= 1);
    assert.equal(httpCalls, 2);

    const db = getDb();
    const [source] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, FOOTBALL_DATA_ORG_PROVIDER_ID));
    const maps = await db
      .select()
      .from(sourceEntityMap)
      .where(
        and(
          eq(sourceEntityMap.sourceId, source.id),
          eq(sourceEntityMap.entityType, "competition"),
          eq(sourceEntityMap.providerEntityId, competitionId),
        ),
      );
    assert.equal(maps.length, 1);

    const [runCount] = await db
      .select({ value: count() })
      .from(ingestionRuns)
      .where(eq(ingestionRuns.sourceId, source.id));
    assert.ok(runCount.value >= 2);
  });

  it("maps official competition aliases and refuses to merge Inter by name", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const apiFootball = new ScriptedProvider(
      "api-football",
      "API-Football",
      normalizeApiFootball,
      {
        leagues: {
          response: [
            {
              league: { id: 39, name: "Premier League", country: "England" },
              country: { name: "England" },
              seasons: [{ year: 2026, current: true }],
            },
          ],
        },
        teams: {
          response: [
            { team: { id: 505, name: "Inter", country: "Italy" } },
          ],
        },
      },
    );
    const footballDataOrg = new ScriptedProvider(
      "football-data-org",
      "football-data.org",
      normalizeFootballDataOrg,
      {
        leagues: {
          competitions: [
            {
              id: 2021,
              name: "Premier League",
              code: "PL",
              area: { name: "England" },
              currentSeason: { startDate: "2025-08-15" },
            },
          ],
        },
        teams: {
          competition: { id: 2019, name: "Serie A", code: "SA" },
          teams: [
            { id: 108, name: "Inter", area: { name: "Italy" } },
          ],
        },
      },
    );

    await runIngestion({
      provider: apiFootball,
      requests: [{ kind: "leagues" }, { kind: "teams" }],
      licenseClass: "official_api",
    });
    await runIngestion({
      provider: footballDataOrg,
      requests: [{ kind: "leagues" }, { kind: "teams" }],
      licenseClass: "official_api",
    });

    const db = getDb();
    const [apiSource] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, "api-football"));
    const [fdSource] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, "football-data-org"));

    const [plApi] = await db
      .select()
      .from(sourceEntityMap)
      .where(
        and(
          eq(sourceEntityMap.sourceId, apiSource.id),
          eq(sourceEntityMap.entityType, "competition"),
          eq(sourceEntityMap.providerEntityId, "39"),
        ),
      );
    const [plFd] = await db
      .select()
      .from(sourceEntityMap)
      .where(
        and(
          eq(sourceEntityMap.sourceId, fdSource.id),
          eq(sourceEntityMap.entityType, "competition"),
          eq(sourceEntityMap.providerEntityId, "2021"),
        ),
      );
    assert.ok(plApi);
    assert.ok(plFd);
    assert.equal(plApi.canonicalId, plFd.canonicalId);

    const [plRows] = await db
      .select({ value: count() })
      .from(competitions)
      .where(eq(competitions.id, plApi.canonicalId));
    assert.equal(plRows.value, 1);

    const [interApi] = await db
      .select()
      .from(sourceEntityMap)
      .where(
        and(
          eq(sourceEntityMap.sourceId, apiSource.id),
          eq(sourceEntityMap.entityType, "team"),
          eq(sourceEntityMap.providerEntityId, "505"),
        ),
      );
    const [interFd] = await db
      .select()
      .from(sourceEntityMap)
      .where(
        and(
          eq(sourceEntityMap.sourceId, fdSource.id),
          eq(sourceEntityMap.entityType, "team"),
          eq(sourceEntityMap.providerEntityId, "108"),
        ),
      );
    assert.ok(interApi);
    assert.ok(interFd);
    assert.notEqual(interApi.canonicalId, interFd.canonicalId);

    const interTeams = await db.select().from(teams);
    const namedInter = interTeams.filter((row) => row.name === "Inter");
    assert.ok(namedInter.length >= 2);
  });
});
