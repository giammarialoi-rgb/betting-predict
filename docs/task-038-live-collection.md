# TASK 038 — Live collection

Source: THE_ODDS_API `/v4/sports/{sport}/odds`.
`last_update` = quote observation timestamp. `commence_time` = kickoff.
Timestamps are stored as received. No timezone invention. No collector clock as quote clock.
football-data.org is fixture/kickoff/result only — never a quote clock.

API_KEY: missing
COLLECTION_STATUS: NOT_CONFIGURED
LIVE_ADAPTER: READY
STRICT_EVENTS: 0

Commands:

```
pnpm collect:task-038
pnpm collect:task-038:loop
```

If the key is missing the collector exits 0 with NOT_CONFIGURED. It does not invent quotes.
