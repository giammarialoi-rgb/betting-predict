import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Atomic write: temp + rename. */
export function atomicWriteJson051(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2));
  renameSync(tmp, path);
}

export function fingerprint051(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function idempotencyKey051(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** Returns true if key already present in jsonl (dedupe). */
export function jsonlHasKey051(path: string, keyField: string, key: string): boolean {
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const j = JSON.parse(line) as Record<string, unknown>;
      if (j[keyField] === key) return true;
    } catch {
      /* skip */
    }
  }
  return false;
}

export function eventDedupeKey051(source: string, sourceEventId: string): string {
  return idempotencyKey051("event", source, sourceEventId);
}

export function quoteDedupeKey051(
  eventId: string,
  bookmaker: string,
  market: string,
  selection: string,
  availableAt: string,
): string {
  return idempotencyKey051("quote", eventId, bookmaker, market, selection, availableAt);
}

export function settlementDedupeKey051(eventId: string): string {
  return idempotencyKey051("settle", eventId);
}

export function learningCaseDedupeKey051(eventId: string, errorType: string, modelVersion: string): string {
  return idempotencyKey051("learn", eventId, errorType, modelVersion);
}
