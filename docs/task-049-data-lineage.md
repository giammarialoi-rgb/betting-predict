# TASK 049 — Data lineage

Lab A `audit/external/task-039` — READ_ONLY forever.

Lab B `audit/external/task-044` — append-only prospective store.

Contexts: PRE_LOCK → LOCK → POST_LOCK → SETTLEMENT → AUTOPSY.

Never mix post-lock / result into DecisionContext.
