# Sports Prediction Engine

Research and simulation web app. The goal is to test whether quantitative models, using **only information available before an event**, can find inefficiencies versus market odds.

This is **not** a bookmaker, payment, or live-betting product. There is no real-money flow.

## Stack (TASK 002)

- Next.js App Router + TypeScript + pnpm
- Neon Postgres (dedicated project `sports-prediction-engine`)
- Drizzle ORM

Do **not** point `DATABASE_URL` at the `noleggio spiaggia rosa` Neon project.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Put the connection string of the **Sports Prediction Engine** Neon project into `.env.local`.

```bash
pnpm db:migrate
pnpm test
pnpm dev
```

- Status page: `/`
- Health JSON: `GET /api/health`

## Database

Operational tables (Neon). Domain catalogs in `src/domain/` are the static metadata source of truth.

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

## License / use

Personal research. Predictions, when they exist, are experiments — not betting advice.
