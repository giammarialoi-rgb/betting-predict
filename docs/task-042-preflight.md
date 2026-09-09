# TASK 042 — Preflight audit

Date: 2026-09-08  
Store inspected: `audit/external/task-039/`  
No store files deleted or rewritten during this audit.

## 1. Current collector topology

| Component | Path | Role |
|---|---|---|
| Loop (Cursor-bound) | `src/scripts/collect-loop-task-040.ts` | `setInterval` in foreground Node; dies with terminal/Cursor |
| Collect once 040 | `src/scripts/collect-task-040.ts` | Single pull + recover locks |
| Core collect | `src/domain/eval/live-039/collector.ts` | Append-only events/quotes + live-window LOCK |
| Recover LOCK | `src/domain/eval/recover-040/lock.ts` | AS_OF T−1h LOCK without live window |
| Reveal | `src/domain/eval/live-039/settle.ts` | Scores → settlement ledger |
| Live adapter | `src/domain/eval/live-039/sources.ts` | Fan-out to **6 sports** odds |
| Odds HTTP | `src/domain/eval/prospective-036/sources.ts` | `/v4/sports/{sport}/odds?regions=uk,eu&markets=h2h` |
| Scores HTTP | `pullScores039` | Default **one** sport (`soccer_epl`) only |
| Audit/lab | `audit/lab:task-040`, `audit/lab:task-041` | Scientific close; no Windows persistence |

**No Windows Task Scheduler / cron / service exists today.**  
**No process lock / single-instance guard.**  
**No credit-state / heartbeat files.**

## 2. Active process check (preflight)

- No dedicated `collect-loop-task-040` terminal session observed as running.
- Multiple unrelated `node` processes may exist (Next/IDE); none identified as TASK 042 collector (collector not installed yet).
- Conclusion: **safe to install a single persistent collector** after implementing lockfile.

## 3. Credit / request accounting (current)

### Odds pull (every loop cycle today)

- Sports: EPL, Serie A, La Liga, Bundesliga, Ligue 1, UCL → **6 HTTP calls**.
- Query: `regions=uk,eu`, `markets=h2h`.
- Provider cost rule (documented): **1 credit × markets × regions** → **2 credits/sport**.
- **Estimated full odds cycle ≈ 12 credits** (before retries).
- `withRetry` maxRetries=2 can multiply cost on transient failures.

### Scores pull

- `revealOnce039` → `pullScores039` defaults to **soccer_epl only**.
- Multi-league events beyond EPL may never settle via current reveal path.
- Scores responses expose the same usage headers; cost not invented here — use `x-requests-last` when observed.

### Headers (provider, not currently captured)

The Odds API returns on every call:

- `x-requests-remaining`
- `x-requests-used`
- `x-requests-last`

**Current adapters discard response headers** — only JSON body is read.  
TASK 042 must capture these without inventing values when absent.

### Local counters

- `journal.jsonl` records pull status/event/quote counts — **not** credit headers.
- Dedup: `quoteKey039` → duplicate quotes skipped (`IGNORED_DUPLICATE`).
- Catalog rediscovery: every cycle re-fetches full sport odds catalogs even when events=0 (no new inserts).

## 4. Poll interval

- `experiments/exp_039_prospective_live.json` → `poll_interval_ms` (typically 15 minutes if set to 900000).
- Loop uses that interval blindly for a **full 6-sport odds pull + reveal**.
- At ~12 credits/odds cycle: aggressive enough to exhaust a 500 free quota in ~40 cycles (~10 hours) if run continuously — **unsafe without governor**.

## 5. Store state (must preserve)

Expected (user-verified audit):

- EVENTS ≈ 114  
- QUOTES ≫ 70k  
- LOCKED = 114  
- SETTLED = 0  

Files: `events.jsonl`, `quotes.jsonl`, `journal.jsonl`, `decisions.jsonl`, raw snapshots.  
**Do not truncate, rewrite, or re-seed.** Append-only only.

## 6. Scientific constraints (unchanged)

- `available_at` = source `last_update`, never `collected_at`
- AS_OF T−1h = max(source ≤ kickoff−3600s)
- LOCK immutable; FT/HT only in settlement ledger
- TASK_031_BASE frozen SHA `6d78ca34…174b`
- MARKET_DEVIG / models / staking / capital gate untouched
- TASK 041 lab runs only when `SETTLED_EVENTS >= 100`

## 7. Design implications for TASK 042

1. **Default cycle = settlement-first**: scores for sports with past-kickoff unsettled locked events; skip full odds catalog when all known events are already locked.
2. **Discovery odds** at low frequency (env-configurable), budget-gated.
3. Prefer **single region** only if explicitly configured later; default keep `uk,eu` for scientific continuity on rare discovery.
4. Capture provider credit headers as source of truth when present; else conservative local estimates.
5. Windows Task Scheduler + PID lockfile + heartbeat + UI reading persisted JSON only.
6. Fix multi-sport scores reveal for settlement completeness **without** changing DecisionContext semantics.

## 8. Preflight verdict

| Check | Result |
|---|---|
| Store present | YES (do not wipe) |
| Cursor-independent collector | MISSING → implement |
| Credit governor | MISSING → implement |
| Header capture | MISSING → implement |
| Dual collector risk | No TASK 042 process yet; add lock |
| Full catalog every 15m | YES today → must stop by default |
| Synthetic data risk | NONE planned |

Proceed to implementation.
