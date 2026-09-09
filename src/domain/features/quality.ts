export type QualityVerdict = "VALID" | "WARNING" | "REJECTED";

export type QualityIssue = {
  code: string;
  verdict: QualityVerdict;
  message: string;
};

export function validateDecimalOdds(odds: number): QualityIssue | null {
  if (!Number.isFinite(odds) || odds <= 1) {
    return {
      code: "invalid_odds",
      verdict: "REJECTED",
      message: `odds must be finite and > 1, got ${odds}`,
    };
  }
  return null;
}

export function validateScore(home: number, away: number): QualityIssue | null {
  if (
    !Number.isInteger(home) ||
    !Number.isInteger(away) ||
    home < 0 ||
    away < 0
  ) {
    return {
      code: "impossible_score",
      verdict: "REJECTED",
      message: `impossible score ${home}-${away}`,
    };
  }
  return null;
}

export function validateNonNegativeStat(
  name: string,
  value: number | null | undefined,
): QualityIssue | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) {
    return {
      code: "negative_statistics",
      verdict: "REJECTED",
      message: `${name}=${value}`,
    };
  }
  return null;
}

export function validateTeamSelfMatch(
  homeTeamId: string,
  awayTeamId: string,
): QualityIssue | null {
  if (homeTeamId === awayTeamId) {
    return {
      code: "team_self_match",
      verdict: "REJECTED",
      message: "home and away team ids are identical",
    };
  }
  return null;
}

export function validateOverroundPositive(overround: number): QualityIssue | null {
  if (!(overround > 0)) {
    return {
      code: "overround_le_0",
      verdict: "REJECTED",
      message: `overround=${overround}`,
    };
  }
  if (overround < 1) {
    return {
      code: "overround_lt_1",
      verdict: "WARNING",
      message: "overround < 1 is unusual for a complete market",
    };
  }
  return null;
}

export function validateProbability(p: number): QualityIssue | null {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    return {
      code: "invalid_probability",
      verdict: "REJECTED",
      message: `probability=${p}`,
    };
  }
  return null;
}

export function validateEventDate(d: Date): QualityIssue | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return {
      code: "invalid_dates",
      verdict: "REJECTED",
      message: "invalid date",
    };
  }
  return null;
}

export function detectDuplicateKeys(keys: readonly string[]): QualityIssue[] {
  const seen = new Set<string>();
  const issues: QualityIssue[] = [];
  for (const k of keys) {
    if (seen.has(k)) {
      issues.push({
        code: "duplicate_event",
        verdict: "REJECTED",
        message: `duplicate key ${k}`,
      });
    }
    seen.add(k);
  }
  return issues;
}

export function runDataQualityChecks(input: {
  odds?: number[];
  score?: { home: number; away: number };
  homeTeamId?: string;
  awayTeamId?: string;
  overround?: number;
  probability?: number;
  dates?: Date[];
  identityKeys?: string[];
}): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const o of input.odds ?? []) {
    const i = validateDecimalOdds(o);
    if (i) issues.push(i);
  }
  if (input.score) {
    const i = validateScore(input.score.home, input.score.away);
    if (i) issues.push(i);
  }
  if (input.homeTeamId && input.awayTeamId) {
    const i = validateTeamSelfMatch(input.homeTeamId, input.awayTeamId);
    if (i) issues.push(i);
  }
  if (input.overround !== undefined) {
    const i = validateOverroundPositive(input.overround);
    if (i) issues.push(i);
  }
  if (input.probability !== undefined) {
    const i = validateProbability(input.probability);
    if (i) issues.push(i);
  }
  for (const d of input.dates ?? []) {
    const i = validateEventDate(d);
    if (i) issues.push(i);
  }
  if (input.identityKeys) {
    issues.push(...detectDuplicateKeys(input.identityKeys));
  }
  return issues;
}
