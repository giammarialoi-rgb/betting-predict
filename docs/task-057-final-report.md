# TASK 057 — API-Sports data foundation

## FINAL_VERDICT: PASS

API-Sports integrated as an isolated **source adapter** (data foundation only).
No Lab A mutation. No new supervisor/worker/brain. No MODEL_v2 change. No TASK 058.

## Verified Free-plan constraints (real probes)

| Constraint | Detail |
|------------|--------|
| Plan | Free · 100 req/day · 10 req/min |
| Seasons | **2022–2024 only** (2025/2026 → PLAN_LIMITED) |
| Fixtures `next` | **PLAN_LIMITED** — use `league`+`season` or `date` |
| Discovery season used | **2024** · league 39 (Premier League) |

## Capability matrix (lab run)

**AVAILABLE:** status, leagues, fixtures, teams, standings, teams_statistics, headtohead, players_statistics, injuries, odds, fixtures_events

**PLAN_LIMITED:** (none in successful Free-compatible probes)

**UNAVAILABLE:** (none when key configured)

Normalized sample events: **5** (from season fixture list; full season not stored as catalog dump).

## Budget

- Local governor: `audit/external/task-044/api-sports/request-budget.json`
- Min interval ~6.5s between network calls
- Cache dedupe under `api-sports/cache/`
- Lab run charged a small number of new requests; remaining reported in artifacts

## Module

`src/domain/data-sources/api-sports/`

- `client.ts` — env key, timeout, rate/budget, redact
- `adapter.ts` — sample fixtures fetch
- `capabilities.ts` — discovery
- `health.ts` — Control Center health
- `normalize.ts` — event normalization (`source=API_SPORTS`)
- `contract.ts` — independent model contract **types only**
- `budget.ts` / `cache.ts` / `config.ts`

Keys: `API_SPORTS_KEY` (preferred) or `API_FOOTBALL_KEY`. **Never logged.**

## Observability

- Lab B: `audit/external/task-044/api-sports/{capabilities,source-health,request-budget}.json`
- Health API: `api_sports_057` on `/api/permanent-live/health`
- Health UI: `/actuarial-lab/live-total/health` — API-Sports panel
- Source registry includes **API-Sports** as ALLOWED_API

## Commands

```
pnpm lab:task-057
pnpm audit:task-057
```

## Artifacts

`artifacts/task-057/` — capabilities, source-health, request-budget, normalization-report, final-report, result JSON.

## Explicit non-goals (held)

- No independent MODEL probability yet
- No BET from API-Sports
- No Odds API replacement
- No aggressive 24/7 polling of API-Sports
- `open_task_058: false`
