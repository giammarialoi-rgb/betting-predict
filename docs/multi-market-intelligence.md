# Multi-market intelligence (TASK 007-A)

Philosophy: not “who will win?” only — ask which **future property** of an event is predictable from information knowable before the event, **market by market**, vs the market price.

Stack:

```text
SPORT → EVENT → MARKET → LINE → SELECTION → ODDS SNAPSHOT → FEATURES → OUTCOME
```

Key modules under `src/domain/markets/`: taxonomy, discovery, lines, outcomes, matrix, microstructure, feature-map, coverage, correlations, opportunities.

`findBestSupportedOpportunities` replaces the notion of “safe bets”; `confidence` stays `null` until calibrated.
