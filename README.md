# Sports Prediction Engine

Research and simulation web app. The goal is to test whether quantitative models, using **only information available before an event**, can find inefficiencies versus market odds.

This is **not** a bookmaker, payment, or live-betting product. There is no real-money flow.

## Stack (TASK 002 / Phase 8)

- Next.js App Router + TypeScript + pnpm
- **Filesystem StorageProvider** (Lab B JSONL under `audit/external/task-044`, plus `data/`)
- **NEON NON UTILIZZATO** — Neon is not the store, not a fallback, and not on the core pipeline.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Do not set `DATABASE_URL` for BetMind. The worker, research, predictions, light cache, and runtime mirror use files.

```bash
pnpm test
pnpm dev
```

- Status page: `/`
- Health JSON: `GET /api/health`

## Database

**NEON NON UTILIZZATO.** Operational state is JSONL on disk (`getStorage()`). Domain catalogs in `src/domain/` are the static metadata source of truth. Historical Drizzle schema files remain in the repo but are not used by the live pipeline.

- `sports.slug` = `SportDefinition.id` (seed from the TypeScript catalog)
- `data_sources.slug` = implemented `SportsDataProvider.id` only (`api-football`, `football-data-org`, `mock`)
- `ingestion_runs`, `raw_payloads`, `as_of_snapshots`
- `competitions`, `teams`, `events`, `source_entity_map`
- `bookmakers`, `market_snapshots` (append-only historical odds; `odds_decimal numeric(12,6)`)

```bash
pnpm db:generate
pnpm db:migrate
pnpm ingest:mock
```

`pnpm ingest:football` requires `API_FOOTBALL_KEY`. Without it the script exits 1 and sends no request.

`pnpm ingest:football-data-org` requires `FOOTBALL_DATA_ORG_TOKEN`. Without it the script exits 1 and sends no request. Rate limit is configured on the provider (`FOOTBALL_DATA_ORG_MIN_INTERVAL_MS`, default 7000), not hardcoded in the ingestion core.

Historical odds (TASK 005): `pnpm ingest:mock-odds` loads the mock historical market dataset (append-only `market_snapshots`). No commercial odds API and no football-data.co.uk adapter in this task.

`assertAsOf(asOf, availableAt)`: a fact is visible only when `available_at <= as_of`.

## Data sources vs providers

The intelligence catalog (`src/domain/sources`) describes origins. It does **not** create adapters. Scraping is out of scope. Reliability stays unknown.

## BetMind Control Center (Lab B + Vercel)

- UI: `/` (Control Center). Health: `GET /api/betmind/health`. Snapshot: `GET /api/betmind/snapshot`.
- Analytical worker runs on the PC (Lab B under `audit/external/task-044`). Vercel is the API/UI layer.
- Runtime mirror writes `audit/external/task-044/mirror/` (filesystem). No Neon publish.

```bash
pnpm brain:start          # watchdog + worker loop
pnpm brain:once           # one real cycle (add -- --discover to force Odds discovery)
pnpm brain:status
pnpm runtime:publish      # write heartbeat + board to the filesystem mirror
pnpm phase8:mega-verify   # real research cycle (≥20 upcoming when sources return them)
```

Web ONLINE ≠ Runtime ONLINE ≠ Prediction Engine ONLINE. Stale mirror (>10 min) → OFFLINE. `REAL_MONEY=false`; odds never enter the independent MODEL.

## License / use

Personal research. Predictions, when they exist, are experiments — not betting advice.
