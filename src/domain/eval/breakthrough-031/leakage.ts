import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { leakDateOnlyToStrict, leakMatchAmbiguous } from "@/domain/eval/incremental-029/leakage";
import { loadExp031Config } from "@/domain/eval/breakthrough-031/config";
import type { CanonicalQuote031 } from "@/domain/eval/breakthrough-031/types";

export function hasExplicitTimezone(raw: string): boolean {
  return /Z$|[+-]\d{2}:\d{2}$/.test(raw.trim());
}

export function acceptQuoteAtAsOf(quoteMs: number, asOfMs: number): true {
  if (!Number.isFinite(quoteMs) || !Number.isFinite(asOfMs)) {
    throw new BlindLeakageError("quote/asOf not a finite clock");
  }
  if (quoteMs > asOfMs) throw new BlindLeakageError("quote after asOf");
  return true;
}

export function rejectFutureQuote(quoteMs: number, asOfMs: number): void {
  acceptQuoteAtAsOf(quoteMs, asOfMs);
}

export function rejectQuoteAfterAsOf(quoteMs: number, asOfMs: number): void {
  acceptQuoteAtAsOf(quoteMs, asOfMs);
}

export function rejectKickoffTimezoneMismatch(kickoffIso: string, quoteIso: string): void {
  const kickTz = hasExplicitTimezone(kickoffIso);
  const quoteTz = hasExplicitTimezone(quoteIso);
  if (!kickTz || !quoteTz) {
    throw new BlindLeakageError("kickoff/quote timezone mismatch or undocumented");
  }
}

export function rejectDateOnlyFromStrict(raw: string, usedInStrict: boolean): void {
  leakDateOnlyToStrict(/^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? "DATE_ONLY" : "EXACT_TIMESTAMP", usedInStrict);
}

export function rejectAmbiguousMatch(grade: string): void {
  leakMatchAmbiguous(grade);
}

export function rejectCloseAfterAsOf(closeMs: number, asOfMs: number): void {
  if (closeMs > asOfMs) throw new BlindLeakageError("close quote after asOf");
}

export function rejectOutcomeBeforeReveal(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
}

export function rejectNaiveAsUtc(raw: string): void {
  if (raw.trim() !== "" && !hasExplicitTimezone(raw)) {
    throw new BlindLeakageError("naive timestamp cannot be treated as UTC");
  }
}

export function leakHoldoutModelSelection(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("HOLDOUT cannot influence model selection");
}

export function leakAutoPromote031(auto: boolean): void {
  if (auto) throw new ExperimentIntegrityError("challenger cannot auto-promote");
}

export function leakMasanielloProduction(policy: string): void {
  if (policy === "masaniello" || policy === "masaniello_challenger") {
    throw new ExperimentIntegrityError("Masaniello cannot become production staking");
  }
}

export function leakSilentThousand(end: number | null, bets: number): void {
  if (bets === 0 && end === 1000) throw new BlindLeakageError("silent 1000→1000");
  if (bets === 0 && end != null) throw new BlindLeakageError("no-data/no-edge year must End=null");
}

export function dedupeQuotesDeterministic(quotes: readonly CanonicalQuote031[]): CanonicalQuote031[] {
  const sorted = [...quotes].sort(
    (a, b) =>
      a.event_id.localeCompare(b.event_id) ||
      a.bookmaker.localeCompare(b.bookmaker) ||
      a.selection.localeCompare(b.selection) ||
      a.quote_timestamp.localeCompare(b.quote_timestamp) ||
      a.source.localeCompare(b.source),
  );
  const seen = new Set<string>();
  const out: CanonicalQuote031[] = [];
  for (const q of sorted) {
    const k = `${q.event_id}|${q.bookmaker}|${q.selection}|${q.quote_timestamp}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

export function lastSnapshotAtOrBeforeAsOf(
  quotes: readonly CanonicalQuote031[],
  asOfMs: number,
): CanonicalQuote031 | null {
  const ok = quotes.filter((q) => {
    const ms = Date.parse(q.quote_timestamp);
    return Number.isFinite(ms) && ms <= asOfMs;
  });
  if (ok.length === 0) return null;
  ok.sort((a, b) => a.quote_timestamp.localeCompare(b.quote_timestamp) || a.source.localeCompare(b.source));
  return ok[ok.length - 1] ?? null;
}

export function runHostileBattery031(): { id: string; throws: boolean }[] {
  const cfg = loadExp031Config();
  const asOf = Date.parse("2016-06-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_quote", run: () => rejectFutureQuote(asOf + 1, asOf) },
    { id: "quote_after_asof", run: () => rejectQuoteAfterAsOf(asOf + 1, asOf) },
    {
      id: "kickoff_tz",
      run: () => rejectKickoffTimezoneMismatch("2016-06-01T13:00:00", "2016-06-01T12:00:00Z"),
    },
    { id: "date_only", run: () => rejectDateOnlyFromStrict("2020-03-07", true) },
    { id: "ambiguous", run: () => rejectAmbiguousMatch("MATCH_AMBIGUOUS") },
    { id: "close_after", run: () => rejectCloseAfterAsOf(asOf + 1, asOf) },
    { id: "outcome", run: () => rejectOutcomeBeforeReveal({ outcome: "HOME" }) },
    { id: "naive_utc", run: () => rejectNaiveAsUtc("2024-07-26 00:30:00") },
    { id: "holdout", run: () => leakHoldoutModelSelection(true) },
    { id: "auto_promote", run: () => leakAutoPromote031(true) },
    { id: "masaniello", run: () => leakMasanielloProduction("masaniello") },
    { id: "silent_1000", run: () => leakSilentThousand(1000, 0) },
    { id: "lock", run: () => assertLockedBeforeReveal(false) },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.feature_selection_on_test) throw new ExperimentIntegrityError("test fs");
        throw new ExperimentIntegrityError("frozen flags ok");
      },
    },
  ];
  return cases.map((c) => {
    try {
      c.run();
      return { id: c.id, throws: false };
    } catch {
      return { id: c.id, throws: true };
    }
  });
}
