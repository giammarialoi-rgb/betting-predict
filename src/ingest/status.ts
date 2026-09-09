import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataSources, ingestionRuns } from "@/db/schema";

export async function getLastIngestionRun() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(1);
  return row ?? null;
}

export async function listRegisteredDataSources() {
  const db = getDb();
  return db.select().from(dataSources);
}
