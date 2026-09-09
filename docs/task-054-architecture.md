# TASK 054 — Architecture

## Separation

| Layer | Role |
|-------|------|
| EVENT CATALOG SOURCES | DirectaAdapter (policy-gated), future SofaScore/Flashscore |
| ODDS SOURCES | Odds API (primary), future book adapters |
| DecisionEngine / Feature / Autopsy / Learning | Unchanged consumers of triangulated data |

Catalog events may exist with `ODDS_MISSING`. They are never deleted.

## Directa compliance

- `DIRECTA_ENABLED=false` (default)
- `DIRECTA_SCRAPING_ENABLED=false` (default)
- `scrapingAllowedForSource("directa")` remains DENY
- No CAPTCHA/WAF/TLS/login/proxy/fingerprint bypass
- Polite queue (`rate-limit.ts`) exists for authorized mode only

## Lab boundaries

- Lab A `audit/external/task-039` — READ_ONLY
- Lab B `audit/external/task-044` — append-only live + `catalog-054/`

## Identity

`matchEvents054` → `canonical_event_id` + `source-event-map.jsonl`  
Conflicts → `SOURCE_CONFLICT` (no overwrite)
