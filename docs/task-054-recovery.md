# TASK 054 — Recovery

On heal:

1. Assess worker lock + heartbeat
2. If WORKER_DEAD or HEARTBEAT_STALE → RECOVERING
3. Verify no alive worker (or terminate stale heartbeat orphan)
4. Journal `RECOVERY_STARTED`
5. Spawn exactly one `brain-worker`
6. Wait for worker.lock
7. Journal `RECOVERY_SUCCESS` / `RECOVERY_FAILED`
8. Set spawn cooldown

Store recovery is **read-only reconstruct**:

- events / decisions / snapshots / settlements / autopsies / learning
- dedupe by id in memory only
- **never** rewrite Lab A
- **never** mutate existing LOCKs

Lab B remains append-only.
