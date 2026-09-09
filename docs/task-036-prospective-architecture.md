# TASK 036 — Prospective architecture

The lab is a prospective observer, not a historical reconstructor.

```
quote observed → dual clock → event+kickoff → snapshot (append-only)
             → DecisionContext (T−1h) → LOCK → kickoff → settlement → evaluation
```

## Module map

- `src/domain/eval/prospective-036/` — clocks, windows, integrity, adapters, store, collector, lock, health, lab
- `src/scripts/collect-task-036.ts` — one poll cycle
- `src/scripts/collect-loop-task-036.ts` — persistent poller (`poll_interval_ms`)
- `GET /api/data-collection/health` — source health
- `/actuarial-lab` — PROSPECTIVE DATA vs HISTORICAL DATA

## Source abstraction

`OddsSourceAdapter`: `discoverEvents`, `getEvent`, `getMarkets`, `getQuotes`, `getTimestamp`, `getKickoff`, `getProvenance`, `pull`.

Live adapters:

1. **the-odds-api** — `/v4/sports/{sport}/odds` with ISO `commence_time` and `last_update`. This is the only catalogued surface that can produce STRICT quotes.
2. **football-data-org** — scheduled matches with `utcDate` kickoff only. Quotes remain empty. Not sufficient for STRICT odds.

Missing credentials yield `SOURCE_UNAVAILABLE`. No synthetic quotes. No user-credential bypass. No historical archive hunt.

## Storage

Append-only JSONL under `audit/external/task-036/` (gitignored live store):

- `events.jsonl` — `prospective_events`
- `quotes.jsonl` — `prospective_quotes`
- `snapshots.jsonl` — `prospective_snapshots`
- `decisions.jsonl` — `prospective_decisions`
- `journal.jsonl` — pull log / source health
- `audit.jsonl` — integrity notes

Corrections never UPDATE or DELETE. A new event version is appended with `supersedes`.

## Neon schema proposal (NOT applied)

Do not run `drizzle-kit generate` or apply this without an approved schema proposal review.

```sql
-- PROPOSAL ONLY. TASK 036 uses JSONL until a schema is approved.
CREATE TABLE prospective_events (
  event_id text PRIMARY KEY,
  source_event_id text NOT NULL,
  competition text, season text, home_team text, away_team text,
  kickoff_at_utc timestamptz NOT NULL,
  source text NOT NULL, version int NOT NULL, supersedes text,
  ingested_at_utc timestamptz NOT NULL
);
CREATE TABLE prospective_quotes (
  observation_id text PRIMARY KEY,
  event_id text NOT NULL, source_event_id text NOT NULL,
  market text NOT NULL, selection text NOT NULL, odds_decimal numeric NOT NULL,
  quote_observed_at_utc timestamptz NOT NULL,
  source_timestamp_utc timestamptz, collector_timestamp_utc timestamptz NOT NULL,
  temporal_basis text NOT NULL, availability_class text NOT NULL,
  source text NOT NULL, bookmaker text NOT NULL, source_record_id text NOT NULL,
  snapshot_id text, decision_id text, data_fingerprint text NOT NULL
);
CREATE TABLE prospective_snapshots (
  snapshot_id text PRIMARY KEY, event_id text NOT NULL,
  snapshot_at_utc timestamptz NOT NULL, quotes_hash text NOT NULL,
  decision_context_hash text
);
CREATE TABLE prospective_decisions (
  decision_id text PRIMARY KEY, event_id text NOT NULL,
  decision_timestamp_utc timestamptz NOT NULL, state text NOT NULL,
  home_raw numeric, draw_raw numeric, away_raw numeric,
  home_devig numeric, draw_devig numeric, away_devig numeric, overround numeric,
  decision_context_hash text NOT NULL, observation_only boolean NOT NULL
);
CREATE TABLE prospective_settlements (decision_id text PRIMARY KEY, ft text, ht text, settled_at_utc timestamptz);
CREATE TABLE prospective_evaluations (decision_id text PRIMARY KEY, brier numeric, logloss numeric);
CREATE TABLE prospective_source_health (source text PRIMARY KEY, status text, last_success timestamptz, last_error text);
CREATE TABLE prospective_audit_log (at_utc timestamptz, code text, detail text);
```

TASK_031_BASE is not rewritten.
