/**
 * Observation clocks. Coerce parseable instants to ISO-8601 UTC.
 * Never invent a timestamp: empty or unparseable → null.
 */

export type CoercedAvailableAt = {
  iso: string | null;
  /** Caller supplied a non-empty value that is not a defensible clock. */
  unparseable: boolean;
};

/** Date-only (YYYY-MM-DD) is parseable but not an exact instant — do not invent midnight. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** ISO-8601 with a time component (optional offset / Z). */
const ISO_WITH_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;

/** RSS / RFC 2822 pubDate, e.g. "Sat, 12 Sep 2026 18:32:00 +0200". */
const RFC_2822 =
  /^(?:[A-Za-z]{3},\s+)?\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+(?:GMT|UTC|[+-]\d{2}:?\d{2}|[A-Z]{1,5}))?/i;

function hasDefensibleClock(raw: string): boolean {
  if (ISO_WITH_TIME.test(raw)) return true;
  if (RFC_2822.test(raw)) return true;
  if (/\d{1,2}:\d{2}(?::\d{2})?/.test(raw) && /(?:GMT|UTC|Z|[+-]\d{2}:?\d{2})\b/i.test(raw)) {
    return true;
  }
  return false;
}

function toIsoOrNull(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Coerce a raw `available_at` to ISO-8601 UTC when it is a parseable clock.
 * Empty / null → `{ iso: null, unparseable: false }`.
 * Junk / date-only / no time → `{ iso: null, unparseable: true }` (omit; do not invent).
 */
export function coerceAvailableAt(raw: unknown): CoercedAvailableAt {
  if (raw == null) return { iso: null, unparseable: false };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1e11) {
      return { iso: null, unparseable: true };
    }
    const iso = toIsoOrNull(raw);
    return iso ? { iso, unparseable: false } : { iso: null, unparseable: true };
  }
  if (typeof raw !== "string") return { iso: null, unparseable: true };
  const trimmed = raw.trim();
  if (!trimmed) return { iso: null, unparseable: false };
  if (DATE_ONLY.test(trimmed)) return { iso: null, unparseable: true };
  if (!hasDefensibleClock(trimmed)) return { iso: null, unparseable: true };
  const iso = toIsoOrNull(Date.parse(trimmed));
  return iso ? { iso, unparseable: false } : { iso: null, unparseable: true };
}

/** ISO-8601 UTC or null. Never invents a clock. */
export function coerceAvailableAtToIso(raw: unknown): string | null {
  return coerceAvailableAt(raw).iso;
}
