# TASK 036 — Temporal protocol

A historical dataset is not a decision-time dataset. Prospective collection records what the system actually saw.

## Dual clock

| clock | meaning |
|---|---|
| `source_timestamp_utc` | moment declared by the source (`last_update`) |
| `collector_timestamp_utc` | moment this process received the payload |
| `quote_observed_at_utc` | SOURCE when ISO offset is documented; otherwise COLLECTOR |
| `requested_at_utc` | when this pull started |
| `received_at_utc` | when this pull succeeded |

Never use DB `created_at`, file mtime, opening/closing labels, or a calendar date as the quote clock.

Retry must not copy an old `source_timestamp` onto a later attempt and must not invent a timestamp. `requested_at` is the real start of the pull; `received_at` is the successful body.

## Windows

T−72h … T−1m. A window is COVERED (1) only if a real STRICT observation lands in the bin. Missing windows stay 0. No interpolation.

## Decision / LOCK

Decision window frozen: **T−1h**. DecisionContext contains only data available at `decision_timestamp_utc`. After LOCK: no future quotes, FT/HT, close, CLV, later lineups. Crash recovery reads the journal; it does not reconstruct.

State machine: PRELOCK → DECISION → LOCKED → KICKOFF → SETTLED → EVALUATED.

## Partitions (pre-registered, frozen)

From `collection_start` 2026-09-07T00:00:00.000Z:

- TRAIN: +0–90d
- VALIDATION: +90–120d
- TEST: +120–180d
- HOLDOUT: +180–365d

Dates do not move to improve a score. Walk-forward only. No random split.

## Cold start / capital

Until 100 STRICT events: OBSERVATION_ONLY. No betting. No threshold retune. MODEL_READY remains false. Capital opens only after TEST + HOLDOUT + significance + robustness + leakage pass.

## Hard-fail codes

QUOTE_AFTER_KICKOFF, SOURCE_TIME_NON_MONOTONIC, FUTURE_DATA, MISSING_KICKOFF, MISSING_QUOTE_TIME, DUPLICATE_OBSERVATION, AMBIGUOUS_TIMEZONE, POST_LOCK_MUTATION, OUTCOME_BEFORE_LOCK, CLOSE_USED_AS_DECISION, DATE_ONLY_PROMOTION, SYNTHETIC_TIMESTAMP, CLOCK_DRIFT, NAIVE_TIMESTAMP.
