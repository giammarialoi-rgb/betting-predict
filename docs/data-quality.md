# Data quality

Gates return `VALID` | `WARNING` | `REJECTED` without silent repair.

Checks include:

- invalid odds (≤ 1)
- impossible scores
- negative statistics
- invalid dates
- team self-match
- invalid probability
- overround ≤ 0
- duplicate identity keys

Missing data stays missing. Do not impute zeros for form/stats.
