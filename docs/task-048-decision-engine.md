# TASK 048 — Decision Engine

Model: `MODEL_v2_DECISION_ENGINE` (parent `MODEL_v1`). Never auto-promoted.

Lab decisions (not real bets):

| Decision | Meaning |
|----------|---------|
| NO_BET | Edge/signal insufficient |
| BET_CANDIDATE | Positive edge lab class |
| STRONG_CANDIDATE | High edge + confidence + DQ |

Every event with a PredictionRecord gets a DecisionRecord with structured reason codes + WHY.

Capital: CLOSED. Real money: false.
