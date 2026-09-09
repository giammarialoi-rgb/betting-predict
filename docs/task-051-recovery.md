# TASK 051 — Recovery

## Crash classes covered

| Failure | Behavior |
|---------|----------|
| Worker crash | Watchdog detects WORKER_DEAD / HEARTBEAT_STALE → RESTART_WORKER |
| Watchdog crash | Restart via `pnpm brain:start` or Windows autostart |
| Partial JSONL write | Append-only lines; bad lines skipped on read |
| Duplicate event/quote/settle | Fingerprint / event_id sets → `dup` |
| API timeout / 401 / rate limit | Single source failure does not halt other sports (049 adapters) |
| Budget near reserve | Collector STOP_GRACEFULLY (042/047 budget) |
| Windows reboot | Scheduled Task / Startup shortcut relaunches watchdog |

## Idempotency keys

Helpers in `brain-051/integrity.ts`: event, quote, settlement, learning-case keys + atomic JSON writes.

## Verification

```bash
pnpm brain:start
pnpm brain:status
# kill worker PID → watchdog should respawn
pnpm brain:stop
pnpm brain:start
```
