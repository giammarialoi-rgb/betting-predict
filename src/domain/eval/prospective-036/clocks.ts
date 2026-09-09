import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import type { TemporalBasis036 } from "@/domain/eval/prospective-036/types";

export function hasUtcOffset(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const t = raw.trim();
  return /Z$/i.test(t) || /[+-]\d{2}:\d{2}$/.test(t) || /[+-]\d{4}$/.test(t);
}

export function isDateOnly(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

export function isNaiveDateTime(raw: string | null | undefined): boolean {
  if (!raw) return false;
  if (isDateOnly(raw)) return false;
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !hasUtcOffset(raw);
}

export function parseExactUtcMs(raw: string | null | undefined): number | null {
  if (!raw || !hasUtcOffset(raw)) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

export function requireExactUtc(raw: string, label: string): string {
  if (isDateOnly(raw)) throw new BlindLeakageError(`DATE_ONLY_PROMOTION:${label}`);
  if (isNaiveDateTime(raw) || !hasUtcOffset(raw)) throw new BlindLeakageError(`AMBIGUOUS_TIMEZONE:${label}`);
  if (parseExactUtcMs(raw) == null) throw new BlindLeakageError(`MISSING_QUOTE_TIME:${label}`);
  return raw;
}

export function chooseTemporalBasis(input: {
  sourceTimestampUtc: string | null;
  collectorTimestampUtc: string;
}): { basis: TemporalBasis036; quoteObservedAt: string } {
  if (input.sourceTimestampUtc && hasUtcOffset(input.sourceTimestampUtc) && parseExactUtcMs(input.sourceTimestampUtc) != null) {
    return { basis: "SOURCE_TIMESTAMP", quoteObservedAt: input.sourceTimestampUtc };
  }
  if (!hasUtcOffset(input.collectorTimestampUtc)) {
    throw new BlindLeakageError("AMBIGUOUS_TIMEZONE:collector");
  }
  return { basis: "COLLECTOR_TIMESTAMP", quoteObservedAt: input.collectorTimestampUtc };
}

export function isoNow(clock: { now(): Date } = { now: () => new Date() }): string {
  return clock.now().toISOString();
}
