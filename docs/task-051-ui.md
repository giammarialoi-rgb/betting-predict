# TASK 051 — UI Observatory

## Route

`/actuarial-lab/live-total` — local Control Center / Full Observatory.

`/actuarial-lab/live-total/event/[id]` — event journey detail.

## Data path

Browser → `GET /api/permanent-live/status` → `buildObservatory051()` → Lab B disk.

**Zero Odds API calls from the browser** (`api_calls_ui: 0`).

## Panels

- Live header: status, uptime, PID, watchdog, heartbeat, priority, model
- Sport dashboard
- Health / budget / store size
- Activity feed (persistent)
- Massive 049 / Decision 048 / Coverage 047 boards (inherited)
- Event table + top boards from prior permanent-live UI

Poll interval: 4s.
