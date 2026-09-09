# TASK 055 — Control Center

Route: `/actuarial-lab/live-total`

## Panels

1. System health — supervisor / worker / PID / heartbeat / restarts / phase
2. CURRENT WORK — live phase + activity feed timestamps
3. CONSOLIDATION 055 — autostart mechanism, paper capital, sport status reasons
4. Sport dashboard — SOCCER…HOCKEY with ACTIVE / EMPTY_WINDOW / PROVIDER_UNAVAILABLE / BUDGET_DEFERRED (never bare “0”)
5. Multi-source coverage + horizons TODAY / 24H / 72H / 7D
6. Rankings TOP_* (candidates, not auto-bets)
7. Event table (paginated) + detail `/live-total/event/[id]` timeline
8. Paper capital / budget / source health
9. Autopsies / learning / error patterns counters

## Health

`/actuarial-lab/live-total/health` and `/api/permanent-live/health` — disk only, `api_calls_ui: 0`.

## Activity

`/actuarial-lab/live-total/activity` — multi-source feed.
