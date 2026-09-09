# TASK 035 — Temporal audit

STRICT requires: exact quote_timestamp AND exact kickoff_timestamp AND UTC or documented conversion AND MATCH_EXACT AND quote < kickoff AND pre-match AND verifiable provenance.

Classes observed on newly parsed quotes:

- AMBIGUOUS: 171 quote rows
- DATE_ONLY: 2280 quote rows
- POSTMATCH: 1056 quote rows
- RESEARCH_TEMPORAL: 6117 quote rows

- New STRICT_A/B events: 0
- New STRICT 2020+: 0
- Exact quote timestamps (ISO offset present): 6132
- Exact kickoffs (ISO offset present): 6132
- Legacy STRICT_B 2015–16: 10499 (not counted as 035 breakthrough)

Naive datetimes stay AMBIGUOUS. In-play first-goal quotes stay POSTMATCH. Closing samples stay DATE_ONLY. SharpAPI ISO-Z rows stay RESEARCH_TEMPORAL without settled FT / with midnight-ambiguous starts.
