/**
 * Declared market correlation study pairs — no causality, no trading signals.
 */

export type MarketCorrelationPair = {
  leftMarketId: string;
  rightMarketId: string;
  hypothesis: string;
  status: "DECLARED_FOR_STUDY" | "BLOCKED";
};

export const MARKET_CORRELATION_PAIRS: readonly MarketCorrelationPair[] =
  Object.freeze([
    {
      leftMarketId: "result",
      rightMarketId: "total_goals",
      hypothesis: "Match result may correlate with goal totals",
      status: "DECLARED_FOR_STUDY",
    },
    {
      leftMarketId: "total_goals",
      rightMarketId: "corner_total",
      hypothesis: "Goals and corners may share attacking intensity",
      status: "DECLARED_FOR_STUDY",
    },
    {
      leftMarketId: "total_goals",
      rightMarketId: "card_total",
      hypothesis: "Goals and cards may weakly co-vary",
      status: "DECLARED_FOR_STUDY",
    },
    {
      leftMarketId: "result",
      rightMarketId: "asian_handicap",
      hypothesis: "Result and handicap share ordering information",
      status: "DECLARED_FOR_STUDY",
    },
    {
      leftMarketId: "both_teams_to_score",
      rightMarketId: "total_goals",
      hypothesis: "BTTS and totals share scoring intensity",
      status: "DECLARED_FOR_STUDY",
    },
    {
      leftMarketId: "team_total_goals",
      rightMarketId: "total_goals",
      hypothesis: "Team goals compose match goals",
      status: "DECLARED_FOR_STUDY",
    },
  ]);
