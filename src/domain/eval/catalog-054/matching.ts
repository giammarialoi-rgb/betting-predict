import { createHash } from "node:crypto";

/** Normalize team/player names for fuzzy compare — never invent identities. */
export function normalizeParticipant054(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcf\b|\bfc\b|\bac\b|\bsc\b|\bafc\b/g, "")
    .replace(/\binternazionale\b/g, "inter")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type MatchClass054 = "MATCH_EXACT" | "MATCH_HIGH_CONFIDENCE" | "MATCH_REVIEW" | "MATCH_UNMATCHED";

export type MatchResult054 = {
  class: MatchClass054;
  match_score: number;
  match_reason: string;
  canonical_event_id: string | null;
};

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export function matchEvents054(input: {
  sport_a: string;
  sport_b: string;
  p1_a: string;
  p2_a: string;
  p1_b: string;
  p2_b: string;
  kickoff_a: string | null;
  kickoff_b: string | null;
  competition_a?: string | null;
  competition_b?: string | null;
}): MatchResult054 {
  const sportOk = input.sport_a.toLowerCase().includes(input.sport_b.toLowerCase().slice(0, 4)) ||
    input.sport_b.toLowerCase().includes(input.sport_a.toLowerCase().slice(0, 4));
  if (!sportOk) {
    return { class: "MATCH_UNMATCHED", match_score: 0, match_reason: "sport_mismatch", canonical_event_id: null };
  }

  const n1a = normalizeParticipant054(input.p1_a);
  const n2a = normalizeParticipant054(input.p2_a);
  const n1b = normalizeParticipant054(input.p1_b);
  const n2b = normalizeParticipant054(input.p2_b);

  const direct = tokenOverlap(n1a, n1b) + tokenOverlap(n2a, n2b);
  const swapped = tokenOverlap(n1a, n2b) + tokenOverlap(n2a, n1b);
  const partScore = Math.max(direct, swapped) / 2;

  let kickScore = 0.5;
  let kickReason = "kickoff_unknown";
  if (input.kickoff_a && input.kickoff_b) {
    const da = Date.parse(input.kickoff_a);
    const db = Date.parse(input.kickoff_b);
    if (Number.isFinite(da) && Number.isFinite(db)) {
      const diffMin = Math.abs(da - db) / 60_000;
      if (diffMin <= 1) {
        kickScore = 1;
        kickReason = "kickoff_exact";
      } else if (diffMin <= 30) {
        kickScore = 0.85;
        kickReason = "kickoff_within_30m";
      } else if (diffMin <= 120) {
        kickScore = 0.55;
        kickReason = "kickoff_within_2h";
      } else {
        kickScore = 0.1;
        kickReason = "kickoff_far";
      }
    }
  }

  const score = Number((0.65 * partScore + 0.35 * kickScore).toFixed(4));
  const canonSeed = `${input.sport_a}|${[n1a, n2a].sort().join("|")}|${(input.kickoff_a ?? input.kickoff_b ?? "").slice(0, 13)}`;
  const canonical_event_id = createHash("sha256").update(canonSeed).digest("hex").slice(0, 24);

  if (partScore >= 0.99 && kickScore >= 0.99) {
    return { class: "MATCH_EXACT", match_score: score, match_reason: `exact+${kickReason}`, canonical_event_id };
  }
  if (score >= 0.82) {
    return { class: "MATCH_HIGH_CONFIDENCE", match_score: score, match_reason: `high+${kickReason}`, canonical_event_id };
  }
  if (score >= 0.55) {
    return { class: "MATCH_REVIEW", match_score: score, match_reason: `review+${kickReason}`, canonical_event_id };
  }
  return { class: "MATCH_UNMATCHED", match_score: score, match_reason: `low+${kickReason}`, canonical_event_id: null };
}

export type Conflict054 = {
  kind: "SOURCE_CONFLICT";
  field: string;
  source_a: string;
  value_a: unknown;
  source_b: string;
  value_b: unknown;
  available_at: string;
};

export function detectKickoffConflict054(
  sourceA: string,
  kickA: string | null,
  sourceB: string,
  kickB: string | null,
  availableAt: string,
): Conflict054 | null {
  if (!kickA || !kickB) return null;
  const da = Date.parse(kickA);
  const db = Date.parse(kickB);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  if (Math.abs(da - db) <= 60_000) return null;
  return {
    kind: "SOURCE_CONFLICT",
    field: "kickoff_utc",
    source_a: sourceA,
    value_a: kickA,
    source_b: sourceB,
    value_b: kickB,
    available_at: availableAt,
  };
}

export function marketNormalize054(label: string): {
  market_type: string | null;
  line: number | null;
  selection: string | null;
  source_market_label: string;
} {
  const raw = label.trim();
  const lower = raw.toLowerCase().replace(",", ".");
  const over = lower.match(/over\s*([0-9]+(?:\.[0-9]+)?)/);
  const under = lower.match(/under\s*([0-9]+(?:\.[0-9]+)?)/);
  if (over) {
    return { market_type: "TOTALS", line: Number(over[1]), selection: "OVER", source_market_label: raw };
  }
  if (under) {
    return { market_type: "TOTALS", line: Number(under[1]), selection: "UNDER", source_market_label: raw };
  }
  if (/^1x2$|^h2h$|match.?winner/i.test(lower)) {
    return { market_type: "H2H", line: null, selection: null, source_market_label: raw };
  }
  return { market_type: null, line: null, selection: null, source_market_label: raw };
}

export function availableAt054(input: {
  source_published_at: string | null;
  ingested_at: string;
}): string {
  // Never invent source_published_at — fall back to ingested_at
  return input.source_published_at ?? input.ingested_at;
}
