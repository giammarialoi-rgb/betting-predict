import { capitalMatchAllowed027, gradeUniqueCount, identityKey } from "@/domain/eval/breakthrough-027/matching";
import type { MatchGrade031, SourceLevel031, TemporalBasis031 } from "@/domain/eval/breakthrough-031/types";
import { hasExplicitTimezone } from "@/domain/eval/breakthrough-031/leakage";

export { identityKey, gradeUniqueCount };

export function capitalMatchAllowed031(grade: MatchGrade031): boolean {
  return capitalMatchAllowed027(grade);
}

export function classifyTemporal(input: {
  kickoff: string | null;
  quoteTimestamp: string | null;
  timestampType: "ABSOLUTE" | "RELATIVE" | "BIN" | "DATE_ONLY" | "OPEN_CLOSE_LABEL" | "UNKNOWN";
  timezoneDocumented: boolean;
  relativeOffsetHours?: number;
}): { level: SourceLevel031; basis: TemporalBasis031; strictOk: boolean; reason: string } {
  if (input.timestampType === "DATE_ONLY") {
    return { level: "DATE_ONLY", basis: "DATE_ONLY", strictOk: false, reason: "DATE_ONLY != STRICT" };
  }
  if (input.timestampType === "OPEN_CLOSE_LABEL") {
    return {
      level: "UNKNOWN",
      basis: "UNKNOWN",
      strictOk: false,
      reason: "OPEN/CLOSE label is not a quote clock",
    };
  }
  if (!input.kickoff) {
    return { level: "UNKNOWN", basis: "UNKNOWN", strictOk: false, reason: "kickoff missing" };
  }
  if (!hasExplicitTimezone(input.kickoff) && !input.timezoneDocumented) {
    return {
      level: "UNKNOWN",
      basis: "UNKNOWN",
      strictOk: false,
      reason: "kickoff timezone undocumented",
    };
  }
  if (input.timestampType === "ABSOLUTE") {
    if (!input.quoteTimestamp) {
      return { level: "UNKNOWN", basis: "UNKNOWN", strictOk: false, reason: "absolute quote timestamp missing" };
    }
    if (!hasExplicitTimezone(input.quoteTimestamp) && !input.timezoneDocumented) {
      return { level: "UNKNOWN", basis: "UNKNOWN", strictOk: false, reason: "quote timezone undocumented" };
    }
    return { level: "LEVEL_A", basis: "EXACT_ABSOLUTE", strictOk: true, reason: "absolute clocks" };
  }
  if (input.timestampType === "RELATIVE" || input.timestampType === "BIN") {
    const offset = input.relativeOffsetHours;
    if (offset == null || !Number.isInteger(offset) || offset < 1) {
      return {
        level: "LEVEL_C",
        basis: "BIN_DOCUMENTED",
        strictOk: false,
        reason: "relative/bin offset not documented for T-1h",
      };
    }
    if (!input.timezoneDocumented && !hasExplicitTimezone(input.kickoff)) {
      return { level: "UNKNOWN", basis: "UNKNOWN", strictOk: false, reason: "relative clock needs kickoff TZ" };
    }
    return {
      level: "LEVEL_B",
      basis: "EXACT_RELATIVE",
      strictOk: true,
      reason: `kickoff − ${offset}h documented`,
    };
  }
  return { level: "UNKNOWN", basis: "UNKNOWN", strictOk: false, reason: "temporal semantics not demonstrated" };
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

export function inspectFiveDollarCsv(text: string): {
  rows: number;
  events: number;
  kickoff_utc: boolean;
  quote_timestamp: boolean;
  strict_events: number;
  reason: string;
} {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { rows: 0, events: 0, kickoff_utc: false, quote_timestamp: false, strict_events: 0, reason: "empty" };
  }
  const header = parseCsvLine(lines[0]!);
  const kickIdx = header.indexOf("kickoff_utc");
  const openH = header.indexOf("opening_1x2_home");
  const closeH = header.indexOf("closing_1x2_home");
  const hasQuoteCol = header.some((h) => /timestamp|last_update|available_at|quote/i.test(h));
  const events = Math.max(0, lines.length - 1);
  return {
    rows: events,
    events,
    kickoff_utc: kickIdx >= 0,
    quote_timestamp: hasQuoteCol,
    strict_events: 0,
    reason:
      openH >= 0 || closeH >= 0
        ? "kickoff_utc documented ISO UTC; opening/closing 1X2 have no quote clock — RESEARCH"
        : "no 1X2 columns",
  };
}

export function inspectJulienOddsCsv(text: string): {
  rows: number;
  matches: number;
  naive_timestamps: boolean;
  insert_after_match: boolean;
  strict_events: number;
  reason: string;
} {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return {
      rows: 0,
      matches: 0,
      naive_timestamps: false,
      insert_after_match: false,
      strict_events: 0,
      reason: "empty",
    };
  }
  const header = parseCsvLine(lines[0]!);
  const iMatch = header.indexOf("match_id");
  const iCommence = header.indexOf("commence_time");
  const iLast = header.indexOf("bookmaker_last_update");
  const iInsert = header.indexOf("datetime_insert");
  const ids = new Set<string>();
  let naive = false;
  let insertAfter = false;
  for (let n = 1; n < lines.length; n++) {
    const cols = parseCsvLine(lines[n]!);
    if (iMatch >= 0) ids.add(cols[iMatch] ?? "");
    const commence = iCommence >= 0 ? (cols[iCommence] ?? "") : "";
    const last = iLast >= 0 ? (cols[iLast] ?? "") : "";
    const insert = iInsert >= 0 ? (cols[iInsert] ?? "") : "";
    if ((commence && !hasExplicitTimezone(commence)) || (last && !hasExplicitTimezone(last))) naive = true;
    if (insert && commence && insert.slice(0, 19) > commence.slice(0, 19)) insertAfter = true;
  }
  return {
    rows: lines.length - 1,
    matches: ids.size,
    naive_timestamps: naive,
    insert_after_match: insertAfter,
    strict_events: 0,
    reason:
      "commence_time/bookmaker_last_update are timezone-naive; datetime_insert is post-match and never available_at — RESEARCH",
  };
}
