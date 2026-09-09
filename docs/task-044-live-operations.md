# TASK 044 — Live operations

## Permanent collector (Cursor-independent)

```
pnpm permanent-live:start
pnpm permanent-live:stop
pnpm permanent-live:status
pnpm permanent-live:once
pnpm permanent-live:logs
pnpm permanent-live:recover
```

Start also ensures Lab A `collector:task-042:start` for settlement of the 114.

## Pipeline

```
pnpm discover:task-044
pnpm collect:task-044
pnpm analyze:task-044
pnpm lock:task-044
pnpm settle:task-044
pnpm autopsy:task-044
pnpm learn:task-044
pnpm patterns:task-044
pnpm task:044
pnpm lab:task-044
pnpm audit:task-044
```

Default cycles are disk-sync (0 API). Pass `--api` on collect/settle when budgeted.

## UI

- `/actuarial-lab/live-total`
- `/actuarial-lab/live-total/event/[id]`
- `/actuarial-lab/live` (043 view retained)
