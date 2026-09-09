# TASK 007 — Discovery

**Date:** 2026-09-06  
**Scope:** Sports Intelligence Foundation (no bets, no ROI, no look-ahead)

## 1. Existing architecture

| Layer | Location | Role |
|-------|----------|------|
| Next.js status UI | `src/app/page.tsx` | System status only |
| Neon + Drizzle | `src/db/schema.ts`, `drizzle/0000–0003` | Canonical entities + odds |
| Temporal AS-OF | `src/lib/as-of.ts`, `src/ingest/as-of-query.ts`, `src/ingest/odds-query.ts` | `available_at <= asOf` |
| Odds math / baseline | `src/domain/odds/{math,baseline,temporal}.ts` | Implied, overround, movement, CLV foundation |
| Providers | API-Football, football-data.org, mock, mock-odds, football-data.co.uk | Fetch/normalize |
| Cross-source | `src/domain/cross-source/` | Agreement + verified competition aliases |
| Audit 006-A | `src/audit/club-football-match-data/`, `docs/club-football-match-data-audit.md` | Forensic only |

Temporal contract already in use for odds:

`event_time (scheduled_start_at) ≠ observed_at ≠ available_at ≠ ingested_at`

`requirePrecision=exact` hard-fails on `temporal_precision=unknown`.

## 2. Data available today

**In Neon (production path):**

- `sports`, `competitions`, `teams`, `events` (fixtures; **no FT scores**)
- `source_entity_map`, `data_sources`, `raw_payloads`, `ingestion_runs`
- `bookmakers`, `market_snapshots` (ticks + dataset open/close)

**Offline / audit only (gitignored full CSVs):**

- Club Football Match Data: 238,858 matches, Elo snapshots, Form*, C_*, Bet365/Max odds
- Classified SECONDARY / BENCHMARK / RESEARCH — not STRICT primary

## 3. Sources available

| Source | Role now | Notes |
|--------|----------|-------|
| api-football | PRIMARY provider | fixtures/teams |
| football-data.org | PRIMARY provider | fixtures |
| football-data.co.uk | Historical odds provider | open/close unknown precision; live often 503 |
| mock / mock-odds | Technical | tests |
| clubelo | Catalog only | **no ingest yet** |
| Club Football pack | BENCHMARK | reconstruct Form; never C_*; provisional Elo forbidden STRICT |

## 4. Temporality

Known: `available_at` on entities and market snapshots; dataset anchors for FD.co.uk.  
Unknown: Club Football pack odds open/close; MatchTime as availability (forbidden).  
Kickoff must never become quote/feature availability.

## 5. Leakage risks (from 006-A + schema)

- Post-match FT/HT/stats as prematch features
- Closing odds before close
- Form including current match
- Future / provisional Elo
- Clusters `C_*`
- Silent fuzzy entity merge
- Missing coerced to 0

## 6. Feature candidates (TASK 007)

STRICT / RECONSTRUCTED_STRICT (in-memory history): Form3/5/10 overall/home/away; rolling points/goals/rates; rest days; market implied/overround/disagreement/movement from `market_snapshots` with AS-OF.  
DATASET_WINDOW: ClubElo snapshot ≤ asOf (if provenance verified).  
FORBIDDEN: C_*, post-match stats of event N, closing before decision, provisional Elo.  
BLOCKED until primary ingest: injuries, lineups, news, weather (interfaces only).

## 7. Schema gaps

| Need | Status |
|------|--------|
| Match results / scores on events | **MISSING** — blocks Neon-backed form |
| `feature_observations` append-only | **MISSING** — needed for durable feature AS-OF |
| Elo time series table | **MISSING** |
| Prediction / bet tables | **OUT OF SCOPE** (correctly absent) |

## 8. Implementable without migration

- Feature provenance registry (TypeScript catalog)
- Form + historical rolling engines on in-memory `HistoricalMatch[]`
- ClubElo CSV/as-of helpers + provisional BLOCK
- Market feature engine wrapping existing odds math + AS-OF queries
- Source disagreement structs (odds + generic)
- Entity resolve (exact / map / declarative alias only)
- `buildFeatureSnapshot(event, asOf, inputs)` returning typed cells
- Temporal + data-quality gates (pure)
- Bookmaker benchmark foundation (model vs market structs, no bets)
- Walk-forward evaluation (log_loss, Brier, calibration hooks)
- Explanation object + SportFeatureProvider interface
- `findMostReliableEvents` **skeleton** (no invented confidence)
- UI status section + docs
- ≥10 leakage tests

## 9. Migrations actually necessary (proposal only — not applied in this task)

### SCHEMA PROPOSAL (additive, future TASK)

```text
event_outcomes          — FT/HT scores, available_at = post-final whistle publication
feature_observations    — feature_id, entity_ref, value_json, observed_at, available_at,
                          ingested_at, temporal_precision, source_id, identity_key
elo_snapshots           — team_id or club_key, elo, snapshot_date, provenance
                          (official_clubelo | provisional_blocked)
```

**Decision for TASK 007:** **NO migration applied.** Engines run on explicit in-memory inputs so NO LOOK-AHEAD is testable without inventing Neon scores. Document proposal above; STOP before destructive changes.

## 10. STOP gate

No destructive schema change. Proceed with pure domain + thin orchestration. Neon used only for existing market_snapshots / status counts where already available.
