# TASK 045 — Recovery

- Single-instance lock: `audit/external/task-044/collector.lock`
- Heartbeat: `collector-status.json`
- Checkpoint: `checkpoints/latest.json`
- `pnpm permanent-live:recover` clears stale lock and rebuilds checkpoint from disk
- Restart reloads JSONL ledgers; fingerprints prevent duplicate events/quotes
- Discovery skip if catalog fresh (<2h) unless `--force`
