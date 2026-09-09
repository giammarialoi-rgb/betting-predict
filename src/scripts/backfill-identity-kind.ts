import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { marketSnapshots } from "@/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const db = getDb();
  const rows = await db.select().from(marketSnapshots);
  let updated = 0;
  for (const row of rows) {
    const parts = row.identityKey.split("|");
    if (parts.length === 7) {
      const next = [
        parts[0],
        parts[1],
        parts[2],
        parts[3],
        parts[4],
        row.observationKind,
        parts[5],
        parts[6],
      ].join("|");
      await db
        .update(marketSnapshots)
        .set({ identityKey: next })
        .where(eq(marketSnapshots.id, row.id));
      updated += 1;
    }
  }
  console.log(JSON.stringify({ total: rows.length, updated }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
