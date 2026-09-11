# Phase 8 STEP 1 — Storage audit

**NEON NON UTILIZZATO.** Neon is not the store, not a fallback, and not on the core pipeline.

Commit baseline: `main` @ `dc360a2`.

## Findings

| Store | Path | Role | Neon required? |
|---|---|---|---|
| Lab B ledgers | `audit/external/task-044/*.jsonl` | events, quotes, predictions, locks, settlements, learning, journal | No — already disk |
| Research | `research-queue.json`, `research-status.jsonl`, `research-observations.jsonl` | queue + provenance | No |
| Light analyses | `data/light-analysis/analyses.jsonl` + Lab B copy | Analizzati | No (Neon was optional cache) |
| Light history | `data/light-analysis/history.json`, `/tmp` | FDouk HTTP cache | No — HTTP fetch remains |
| PI artifacts | `predictive-intelligence/**` | models, walk-forward, learning cases | No |
| Runtime mirror | was Neon `betmind_*` | Vercel UI | **Removed** — now `audit/external/task-044/mirror/` |

## Critical-path Neon (before this phase)

Worker, research, predictions already ran disk-first. Neon was an optional Vercel mirror:

- `remote-status.ts` publish/load
- `dossier.ts` upsert/load
- `light-analysis/persist.ts` + `fetch-history.ts` cache
- `acquisition-engine` `persistNeon` (Drizzle `data_sources` / `feature_observations`)
- `brain-051/cycle.ts` dossier mirror

Without `DATABASE_URL` those paths no-oped. On Vercel they were the only calendar/dossier source.

## Decision

Implement `StorageProvider` (`src/domain/storage/`) backed by filesystem JSONL already on host. Gate every core-pipeline Neon write/read. `DATABASE_URL`, if still present in an env file, is **ignored**.

Historical ingest tests that skip without `DATABASE_URL` stay skipped. They are not the live pipeline.

## Preserved working adapters

OpenLigaDB, TheSportsDB, ESPN, RSS, OpenFootball, StatsBomb, Open-Meteo, Football-Data.co.uk, Club-Football-Match-Data, Odds API (when configured), acquisition-engine, identity fail-closed, temporal/odds firewalls, settlement, Analizzati light HTTP history. Not rewritten.

## Abstraction

`source / research / model / prediction / settlement / learning` persist through `getStorage()` or existing Lab B append helpers that write the same files. They do not import `@neondatabase`.
