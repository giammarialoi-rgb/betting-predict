# TASK 038 — Temporal audit

| class | enters capital |
|---|---|
| LEVEL_A_STRICT | yes, if MATCH_EXACT + quote < kickoff + source timestamp |
| LEVEL_B_STRICT | yes, same clocks, weaker semantics |
| RESEARCH_TEMPORAL | no |
| DATE_ONLY | no |
| POSTMATCH | no |
| AMBIGUOUS | no (naive / missing TZ / client retrieval) |
| INVALID | no |

AS_OF: asOf = kickoff − window; last observation with observedAt ≤ asOf; no interpolation.
T−1h lock uses last observation ≤ kickoff−3600s.
OPEN/CLOSE, DATE_ONLY, collector retrieved_at never become quote timestamps.
