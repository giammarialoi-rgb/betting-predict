# TASK 048 — Data Lineage

## Labs

| Lab | Path | Mutability |
|-----|------|------------|
| A | audit/external/task-039 | READ_ONLY |
| B | audit/external/task-044 | Append-only growth |

## Contexts (never mix)

PRE_LOCK → LOCK → POST_LOCK → SETTLEMENT → AUTOPSY

POST_LOCK / result never enter DecisionContext.

## Append-only files (Lab B)

predictions, decisions, feature-snapshots, locks, updates, settlements, autopsies-048, learning-cases, counterfactuals, decision-metrics, model-state, error-patterns, cycle-journal.
