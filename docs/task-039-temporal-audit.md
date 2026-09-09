# TASK 039 — Temporal audit

Coverage windows require an observation whose offset falls in the bin. No interpolation. No CLOSE→T−1h.
AS_OF T−1h: cutoff = commence_time − 3600s; max(source_quote_timestamp ≤ cutoff). Else NO_OBSERVATION.
LOCK DecisionContext uses only AS_OF quotes. FT/HT stay in the settlement ledger.
