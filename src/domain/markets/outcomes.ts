/**
 * Deterministic market outcome evaluators.
 * Outcomes are reconstructed from event facts only — never from odds.
 */

export type MatchScoreFacts = {
  ftHome: number;
  ftAway: number;
  htHome?: number | null;
  htAway?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeYellow?: number | null;
  awayYellow?: number | null;
  homeRed?: number | null;
  awayRed?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeTarget?: number | null;
  awayTarget?: number | null;
};

export type OutcomeResult =
  | { status: "settled"; selection: string; push?: boolean }
  | { status: "void"; reason: string }
  | { status: "unavailable"; reason: string };

function result1x2(home: number, away: number): "HOME" | "DRAW" | "AWAY" {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

export function evaluateResult(facts: MatchScoreFacts): OutcomeResult {
  return {
    status: "settled",
    selection: result1x2(facts.ftHome, facts.ftAway),
  };
}

export function evaluateDoubleChance(
  facts: MatchScoreFacts,
  selection: "HOME_OR_DRAW" | "DRAW_OR_AWAY" | "HOME_OR_AWAY",
): OutcomeResult {
  const r = result1x2(facts.ftHome, facts.ftAway);
  const win =
    (selection === "HOME_OR_DRAW" && (r === "HOME" || r === "DRAW")) ||
    (selection === "DRAW_OR_AWAY" && (r === "DRAW" || r === "AWAY")) ||
    (selection === "HOME_OR_AWAY" && (r === "HOME" || r === "AWAY"));
  return { status: "settled", selection: win ? selection : `NOT_${selection}` };
}

export function evaluateDrawNoBet(
  facts: MatchScoreFacts,
): OutcomeResult {
  const r = result1x2(facts.ftHome, facts.ftAway);
  if (r === "DRAW") return { status: "void", reason: "draw_no_bet_push" };
  return { status: "settled", selection: r };
}

export function evaluateTotalGoals(
  facts: MatchScoreFacts,
  line: number,
): OutcomeResult {
  const total = facts.ftHome + facts.ftAway;
  if (Math.abs(total - line) < 1e-9 && Number.isInteger(line)) {
    return { status: "void", reason: "integer_line_push" };
  }
  return {
    status: "settled",
    selection: total > line ? "OVER" : "UNDER",
  };
}

export function evaluateBothTeamsToScore(facts: MatchScoreFacts): OutcomeResult {
  const yes = facts.ftHome > 0 && facts.ftAway > 0;
  return { status: "settled", selection: yes ? "YES" : "NO" };
}

export function evaluateCorrectScore(facts: MatchScoreFacts): OutcomeResult {
  return {
    status: "settled",
    selection: `${facts.ftHome}-${facts.ftAway}`,
  };
}

export function evaluateHalfTimeResult(facts: MatchScoreFacts): OutcomeResult {
  if (facts.htHome === null || facts.htHome === undefined ||
      facts.htAway === null || facts.htAway === undefined) {
    return { status: "unavailable", reason: "missing_ht_score" };
  }
  return {
    status: "settled",
    selection: result1x2(facts.htHome, facts.htAway),
  };
}

export function evaluateCornerTotal(
  facts: MatchScoreFacts,
  line: number,
): OutcomeResult {
  if (
    facts.homeCorners === null ||
    facts.homeCorners === undefined ||
    facts.awayCorners === null ||
    facts.awayCorners === undefined
  ) {
    return { status: "unavailable", reason: "missing_corners" };
  }
  const total = facts.homeCorners + facts.awayCorners;
  return {
    status: "settled",
    selection: total > line ? "OVER" : "UNDER",
  };
}

export function evaluateCardTotal(
  facts: MatchScoreFacts,
  line: number,
): OutcomeResult {
  const vals = [
    facts.homeYellow,
    facts.awayYellow,
    facts.homeRed,
    facts.awayRed,
  ];
  if (vals.some((v) => v === null || v === undefined)) {
    return { status: "unavailable", reason: "missing_cards" };
  }
  const total =
    (facts.homeYellow ?? 0) +
    (facts.awayYellow ?? 0) +
    (facts.homeRed ?? 0) +
    (facts.awayRed ?? 0);
  return {
    status: "settled",
    selection: total > line ? "OVER" : "UNDER",
  };
}

/**
 * Whole-number Asian handicap settlement (no quarter split).
 * Home line applied to home goals; away wins if home+line < away.
 */
export function evaluateAsianHandicapWhole(
  facts: MatchScoreFacts,
  homeLine: number,
): OutcomeResult {
  const adjusted = facts.ftHome + homeLine - facts.ftAway;
  if (Math.abs(adjusted) < 1e-9) {
    return { status: "void", reason: "handicap_push", selection: "PUSH", push: true };
  }
  return {
    status: "settled",
    selection: adjusted > 0 ? "HOME" : "AWAY",
  };
}

export function evaluatePlayerThreshold(
  observed: number | null | undefined,
  line: number,
): OutcomeResult {
  if (observed === null || observed === undefined) {
    return { status: "unavailable", reason: "missing_player_stat" };
  }
  return {
    status: "settled",
    selection: observed > line ? "OVER" : "UNDER",
  };
}

export function evaluateMarketOutcome(input: {
  marketId: string;
  selection?: string;
  line?: number | null;
  facts: MatchScoreFacts;
  playerStat?: number | null;
}): OutcomeResult {
  switch (input.marketId) {
    case "result":
    case "winner":
      return evaluateResult(input.facts);
    case "double_chance":
      if (
        input.selection !== "HOME_OR_DRAW" &&
        input.selection !== "DRAW_OR_AWAY" &&
        input.selection !== "HOME_OR_AWAY"
      ) {
        return { status: "unavailable", reason: "missing_selection" };
      }
      return evaluateDoubleChance(input.facts, input.selection);
    case "draw_no_bet":
      return evaluateDrawNoBet(input.facts);
    case "total_goals":
    case "total":
      if (input.line === null || input.line === undefined) {
        return { status: "unavailable", reason: "missing_line" };
      }
      return evaluateTotalGoals(input.facts, input.line);
    case "both_teams_to_score":
      return evaluateBothTeamsToScore(input.facts);
    case "correct_score":
      return evaluateCorrectScore(input.facts);
    case "half_time_result":
      return evaluateHalfTimeResult(input.facts);
    case "corners":
    case "corner_total":
      if (input.line === null || input.line === undefined) {
        return { status: "unavailable", reason: "missing_line" };
      }
      return evaluateCornerTotal(input.facts, input.line);
    case "cards":
    case "card_total":
      if (input.line === null || input.line === undefined) {
        return { status: "unavailable", reason: "missing_line" };
      }
      return evaluateCardTotal(input.facts, input.line);
    case "asian_handicap":
      if (input.line === null || input.line === undefined) {
        return { status: "unavailable", reason: "missing_line" };
      }
      return evaluateAsianHandicapWhole(input.facts, input.line);
    case "player_goals":
    case "player_assists":
    case "player_shots":
    case "player_shots_on_target":
      if (input.line === null || input.line === undefined) {
        return { status: "unavailable", reason: "missing_line" };
      }
      return evaluatePlayerThreshold(input.playerStat, input.line);
    default:
      return {
        status: "unavailable",
        reason: `no_evaluator_for_${input.marketId}`,
      };
  }
}
