import { lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { events } from "@/db/schema";
import { assertAsOf } from "@/lib/as-of";

export async function listEventsAsOf(asOf: Date) {
  const db = getDb();
  const rows = await db
    .select()
    .from(events)
    .where(lte(events.availableAt, asOf));

  return rows.filter((row) => {
    try {
      assertAsOf(asOf, row.availableAt);
      return true;
    } catch {
      return false;
    }
  });
}
