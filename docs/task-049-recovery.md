# TASK 049 — Recovery

Daemon independent of Cursor/UI.

Append-only JSONL + checkpoint + lock file + heartbeat.

Crash mid-cycle: restart resumes; fingerprint dedupe prevents duplicate events/decisions.
