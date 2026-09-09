import { sql } from "drizzle-orm";
import { getDb } from "./client";

export async function pingDatabase(): Promise<void> {
  const db = getDb();
  await db.execute(sql`select 1`);
}
