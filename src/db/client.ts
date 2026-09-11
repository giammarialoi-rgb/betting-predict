import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDatabaseUrl(): string {
  throw new Error("NEON NON UTILIZZATO — filesystem StorageProvider only. DATABASE_URL is ignored.");
}

export function getDb() {
  return drizzle(neon(getDatabaseUrl()), { schema });
}
