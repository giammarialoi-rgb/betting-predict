# TASK 042 — Recovery

| failure | behavior |
|---|---|
| Cursor/terminal closed | daemon continues (detached Start-Process / Scheduled Task) |
| Node crash | Task Scheduler RestartCount=3 / RestartInterval=5m; manual `start` |
| PC reboot | AtLogOn scheduled task |
| Manual stop | `collector:task-042:stop` → STOPPED, lock removed |
| Stale heartbeat | UI shows STALE / NOT_RUNNING if PID dead or heartbeat older than 45m |

On restart: load existing store; dedup quotes; never rewrite LOCK/settlements; recoverLocks is idempotent.
