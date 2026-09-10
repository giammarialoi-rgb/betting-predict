/**
 * One-shot: mirror Lab B analysis dossiers to Neon for Vercel event pages.
 * Does not invent dossiers; skips events that cannot be built from disk.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { mirrorDossiersToNeon } from "@/domain/eval/betmind-runtime/dossier";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const root = permanentRoot044();
  const eventIds = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;
  console.log(
    JSON.stringify(
      {
        lab_b: root,
        has_database_url: Boolean(process.env.DATABASE_URL),
        limit,
        forced_ids: eventIds.length || null,
      },
      null,
      2,
    ),
  );
  const result = await mirrorDossiersToNeon(root, {
    limit: Number.isFinite(limit) ? limit : 200,
    eventIds: eventIds.length ? eventIds : undefined,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
