# TASK 036 — Collection runbook

## One-time setup

1. Copy `.env.example` → `.env.local`.
2. Set `THE_ODDS_API_KEY` (do not commit it). Optional `FOOTBALL_DATA_ORG_TOKEN` for kickoff/settlement later.
3. Without the odds key the collector stays `SOURCE_UNAVAILABLE`. Do not invent quotes.

## Commands

- `pnpm collect:task-036` — one poll cycle, append-only, restart-safe.
- `pnpm collect:task-036:loop` — persistent poller at `poll_interval_ms` (default 15 min).
- `pnpm lab:task-036` — dual replay; fingerprint must match.
- `pnpm audit:task-036` — frozen flags, BETS=0, BANKROLL=—.
- `GET /api/data-collection/health` — source / coverage / clocks.
- `/actuarial-lab` — prospective vs historical panels.

## Operating rules

1. Do not change features, thresholds, models, decision window, market definition, or stake policy while this experiment is collecting. A change is a new experiment version.
2. Until 100 STRICT events: observation only. Do not bet. Do not retune.
3. At 100 / 500 / 1000 STRICT events: audit + replay. Still no capital promotion.
4. If SOURCE_UNAVAILABLE: stop and report the blocker. Do not hunt historical archives. Do not open TASK 037.
5. Streaming is preferred when a source offers it. The Odds API is polling-only; do not assume a frequency the vendor does not guarantee.
