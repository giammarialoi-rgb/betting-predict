# TASK 049 — Decision engine

Reuses MODEL_v2_DECISION_ENGINE (TASK 048).

Every event gets DecisionRecord + multi-market board:

EVENT → markets A/B/C → BEST_MARKET_FOR_EVENT

0 BET after thousands of events is a valid outcome.
