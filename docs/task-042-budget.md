# TASK 042 — Budget

## Observed waste (pre-042)

Full odds pull every ~15m × 6 sports × (`uk`+`eu`) × `h2h` ≈ **12 credits/cycle**.

## Governor rules

1. Stop non-essential polling if remaining ≤ `SAFE_REMAINING` (100)
2. Skip cycle if estimated cost > `MAX_CREDITS_PER_RUN` (20)
3. Prefer scores for settlement; skip discovery while locked cohort already ≥ 100
4. Capture provider headers; else conservative local estimates (no fake precision)
5. 401/403 → `PAUSED_ERROR`; 429 → exponential backoff

Bootstrap from account UI (optional env): remaining 402 / used 98 / limit 500 — overwritten by headers on first paid call.
