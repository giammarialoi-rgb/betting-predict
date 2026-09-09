# TASK 039 — Live data contract

| field | meaning |
|---|---|
| commence_time | kickoff UTC from source |
| last_update / source_quote_timestamp | SOURCE_QUOTE_TIMESTAMP |
| collected_at | collector clock, never available_at |
| available_at | === source_quote_timestamp or null |

Missing last_update → INVALID. Missing commence_time → INVALID_KICKOFF.
football-data.org remains fixture/result only.
