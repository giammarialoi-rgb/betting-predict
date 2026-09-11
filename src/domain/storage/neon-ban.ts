/**
 * Phase 8 — Neon is out of use for the core pipeline.
 * NEON NON UTILIZZATO
 *
 * Historical ingest helpers may still import @neondatabase, but they must
 * never run on the worker / research / prediction / light / runtime path.
 */

export const NEON_IN_USE = false as const;
export const STORAGE_BACKEND = "filesystem" as const;
export const NEON_STATUS_IT = "NEON NON UTILIZZATO";

export function assertNeonBanned(context: string): void {
  if (process.env.BETMIND_FORCE_NEON === "1") {
    throw new Error(
      `NEON_BANNED: ${context} — BETMIND_FORCE_NEON is forbidden on the core pipeline`,
    );
  }
}

/** True only if someone still exported a Neon URL — never treat as a usable store. */
export function neonUrlPresent(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function neonIgnoredReason(): string {
  if (neonUrlPresent()) {
    return "DATABASE_URL is set but ignored — NEON NON UTILIZZATO; filesystem store only";
  }
  return "NEON NON UTILIZZATO — filesystem/JSONL store (audit/external/task-044, data/)";
}
