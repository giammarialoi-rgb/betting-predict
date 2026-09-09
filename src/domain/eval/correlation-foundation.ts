/**
 * Correlation foundation — structure only, no numeric claims without data.
 */

export type CorrelationRelationKind =
  | "same_event"
  | "same_market_family"
  | "same_selection"
  | "same_underlying_variable"
  | "cross_market";

export type CorrelationGroup = {
  id: string;
  sport: string;
  memberMarketTypes: string[];
  relationKinds: CorrelationRelationKind[];
  /** Always null until measured. */
  estimatedCorrelation: null;
  notes: string;
};

export const FOOTBALL_CORRELATION_GROUPS: CorrelationGroup[] = [
  {
    id: "goals_family",
    sport: "football",
    memberMarketTypes: [
      "total_goals",
      "both_teams_to_score",
      "team_total_goals",
      "correct_score",
    ],
    relationKinds: [
      "same_event",
      "same_market_family",
      "same_underlying_variable",
      "cross_market",
    ],
    estimatedCorrelation: null,
    notes: "Structure only — do not claim numeric correlation without data",
  },
  {
    id: "result_family",
    sport: "football",
    memberMarketTypes: ["result", "double_chance", "draw_no_bet"],
    relationKinds: ["same_event", "same_market_family", "cross_market"],
    estimatedCorrelation: null,
    notes: "Structure only",
  },
  {
    id: "corners_cards_family",
    sport: "football",
    memberMarketTypes: ["corners", "cards"],
    relationKinds: ["same_event", "cross_market"],
    estimatedCorrelation: null,
    notes: "Structure only",
  },
];

export function findCorrelationGroup(
  marketType: string,
): CorrelationGroup | null {
  return (
    FOOTBALL_CORRELATION_GROUPS.find((g) =>
      g.memberMarketTypes.includes(marketType),
    ) ?? null
  );
}

export function classifyCorrelationRelation(input: {
  eventA: string;
  eventB: string;
  marketA: string;
  marketB: string;
  selectionA: string;
  selectionB: string;
}): CorrelationRelationKind[] {
  const kinds: CorrelationRelationKind[] = [];
  if (input.eventA === input.eventB) kinds.push("same_event");
  const ga = findCorrelationGroup(input.marketA);
  const gb = findCorrelationGroup(input.marketB);
  if (ga && gb && ga.id === gb.id) kinds.push("same_market_family");
  if (input.selectionA === input.selectionB) kinds.push("same_selection");
  if (input.marketA !== input.marketB && input.eventA === input.eventB) {
    kinds.push("cross_market");
  }
  if (
    ["total_goals", "both_teams_to_score", "team_total_goals"].includes(
      input.marketA,
    ) &&
    ["total_goals", "both_teams_to_score", "team_total_goals"].includes(
      input.marketB,
    )
  ) {
    kinds.push("same_underlying_variable");
  }
  return kinds;
}
