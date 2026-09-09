# Source intelligence catalog

In-memory TypeScript catalog. It is not a database and it is not a live integration layer.

## Source vs provider

A **source** is where information originates (a website, dataset, newsroom, or research body).

A **provider** is a technical adapter the software can call (HTTP API, CSV ingest, and so on).

A source may have no usable API. A single provider may later wrap several sources. Listing a source here does **not** authorize scraping or create an adapter.

Implemented provider ids today: `api-football`, `football-data-org` (both also SourceDefinitions) and `mock` (technical only, **not** in this catalog). Historical odds use a separate technical provider id `mock-odds` (also not a SourceDefinition). `data_sources.slug` for sports adapters must equal `SportsDataProvider.id`. Catalog-only ids such as `fbref` must not appear in the sports provider registry.

A source in this catalog is not automatically a provider. A provider is not automatically more reliable than another source. Agreement between sources is recorded; it is not scored.

**Source ≠ bookmaker.** A source is the technical origin of a payload. A bookmaker/operator is who offered the price. They are stored separately (`data_sources` vs `bookmakers`).

## TASK 011 — Scraping & acquisition

**Default scraping = DENY** (`src/domain/sources/scraping-policy.ts`). Sources in this catalog are intelligence entries, not scrape targets.

Added catalog ids: `football-data-co-uk`, `club-football-match-data` (SECONDARY/BENCHMARK), `open-meteo`.

See `docs/data-acquisition-roadmap.md` and `docs/provider-capability-matrix.md`.

## TASK 010 — Real Truth Lab source roles

| Source | Role | Notes |
| --- | --- | --- |
| football-data.co.uk | **PRIMARY** (historical odds + FT/HT results) | Offline pack for lab while live CSV remains **BLOCKED** (HTTP 503). Open/close columns → `temporal_precision=unknown`. Max/Avg are aggregates, **not** bookmakers. |
| ClubElo | **PRIMARY** (ratings) | Official snapshots only. Provisional continuation after cutoff → **BLOCKED** in STRICT_AS_OF. |
| xgabora/Club-Football-Match-Data | **SECONDARY / BENCHMARK / VALIDATION** | Never auto-primary. Forbidden in STRICT path: `C_*`, unverified Form*, provisional Elo, Max/Avg-as-bookmaker. |
| football-data.org | **PRIMARY** (fixtures/results API) | Free tier; PL/SA scope. |
| API-Football | Catalog / optional | Do not introduce paid plans without a separate cost proposal. |

### Cost policy

Prefer FREE / OPEN / PUBLIC sources. Live football-data.co.uk download stays blocked until the endpoint returns HTTP 200. No paid API added in TASK 010.

### Precision honesty

`dataset_open` / `dataset_close` never become `exact`. STRICT_AS_OF DecisionContext excludes unknown-precision quotes; research baselines may use them with explicit `unknown` labeling for market-implied comparison only.


Canonical append-only table `market_snapshots` stores decimal odds as `numeric(12,6)`. Temporal fields stay distinct: event kickoff ≠ `observed_at` ≠ `available_at` ≠ `ingested_at`.

Closing line rule: last snapshot with `available_at <= event.scheduled_start_at` and, for historical queries, `available_at <= asOf`. Post-kickoff rows never count as closing.

`football-data.co.uk` is **not** a continuous tick feed. CSV open/close columns are stored as `observation_kind=dataset_open|dataset_close` with `temporal_precision=unknown` and a UTC midnight **dataset_date_anchor** only. Live download stays **BLOCKED** while the endpoint returns HTTP 503. Use `pnpm ingest:football-data-co-uk` for live attempts; fixtures/tests never require the network.

## football-data.org

Verified metadata for the public API v4 used by the `football-data-org` adapter:

| Field | Value | Notes |
| --- | --- | --- |
| Source id | `football-data-org` | Same id as the implemented provider |
| Domain | football-data.org | Official product site |
| Auth | `X-Auth-Token` via `FOOTBALL_DATA_ORG_TOKEN` | Server-side only. Never commit or log the token |
| Base URL | `https://api.football-data.org/v4` | Overridable with `FOOTBALL_DATA_ORG_BASE_URL` |
| Catalog capabilities | `fixtures`, `results` | Matches endpoint returns both scheduled and finished games |
| Provider capabilities | `health`, `leagues`, `teams`, `fixtures` | Technical fetch kinds. Distinct from the catalog |
| Free tier | true | Token required. Quota and competition access are plan-limited |
| Initial scope | `PL`, `SA` | Premier League and Serie A only. Do not download the world catalog |
| Rate limit | provider config, default 7000 ms | Free plans are commonly ~10 req/min. The core does not hardcode that number |
| Historical depth | unknown | Not verified beyond the current/near-term match window we request |
| Realtime | false | This is a polling API, not a live push feed |
| Official | false | Third-party football-data.org, not a league official feed |
| Reliability | unknown | No invented accuracy or skill score |

### Observed time vs event time

`utcDate` on a match is the scheduled kickoff. It is **not** the time at which we learned the fact.

If a payload includes `lastUpdated`, that value may be stored as `source_published_at`. If it is absent, `source_published_at` stays null and `available_at` falls back to ingest time. A match at 20:00 does not imply the information was available at 20:00.

### Cross-source mapping

Official competition aliases are configured (`PL`/`2021` ↔ API-Football `39`; `SA`/`2019` ↔ `135`). Team names are not keys. Inter (API-Football `505`) and Inter (football-data.org `108`) stay unmerged until a human-verified alias exists.

## Priority vs reliability

`priority` is only the order in which we may *research* an integration (`high` | `medium` | `low`).

`quality.reliability` is an empirical property. In this catalog every quality dimension is `"unknown"`. Do not treat priority as a skill score. After enough observations a future job may write a measured reliability; it must not be guessed today.

## How to add a sport

1. Add a `SportDefinition` in `src/domain/sports/catalog.ts` with a stable slug id (`kebab-case`).
2. Set `eventType` from the shared taxonomy. Do not force every sport into `team_vs_team`.
3. Extend tests if you add a new event type.

Future `SportAdapter` / feature engines should look up this catalog by id. They are not implemented here.

## How to add a source

1. Add a `SourceDefinition` in `src/domain/sources/catalog.ts`.
2. Use a stable id (`clubelo`, `fbref`), not a display name.
3. Reference only sport ids that exist in the sport catalog.
4. Add a capability only if it is actually observed. Otherwise leave `capabilities` empty.
5. Use `"unknown"` for auth, free tier, history, realtime, and official status when unverified.
6. Leave `scrapingAllowed` as `"unknown"`. Never set it to `true` from this task.
7. Keep `quality.*` as `"unknown"`.

## What is treated as verified enough to list a capability

Only capabilities that are visible from the source’s public product (for example ClubElo ratings, FBref historical tables, Opta enterprise stats, newsrooms publishing news). Multi-sport coverage is not assumed just because a brand is well known: sources listed under football stay on `football` unless independently confirmed.

## What remains `unknown`

- Scraping / license permission for every source
- All quality scores (reliability, freshness, latency, coverage, completeness, historical depth, accuracy, availability)
- Capabilities for tipster / opaque sites (SoccerVista, SoccerVital, Betshoot, Click4Soccer, Analysisportiva, SportyTrader, Il Veggente, Abseits, TennisStats, TennisInsight, Tennis Explorer)
- Free-tier, auth, and realtime flags when not confirmed
