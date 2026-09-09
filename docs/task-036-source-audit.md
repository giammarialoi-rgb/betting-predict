# TASK 036 — Source audit

Historical hunt is closed. This audit is only about **live** adapters that can observe the future market.

| source | status | events | quotes | strict events | last error | clock |
|---|---|---:|---:|---:|---|---|
| the-odds-api | SOURCE_UNAVAILABLE | 0 | 0 | 0 | THE_ODDS_API_KEY is not set. Free/paid key required for live odds with last_update + commence_time. Not bypassed. | UNAVAILABLE |
| football-data-org | SOURCE_UNAVAILABLE | 0 | 0 | 0 | FOOTBALL_DATA_ORG_TOKEN is not set. Fixture/kickoff only even when set; no bookmaker quote clock on the free catalog. | UNAVAILABLE |

### the-odds-api

- Surface: `GET /v4/sports/{sport}/odds`
- Kickoff: `commence_time` ISO-Z
- Quote clock: `bookmakers[].last_update` / `markets[].last_update` ISO-Z
- Credential: `THE_ODDS_API_KEY` (not committed)
- If unset: SOURCE_UNAVAILABLE. Not bypassed.

### football-data-org

- Surface: `GET /v4/matches?status=SCHEDULED`
- Kickoff: `utcDate` ISO-Z
- Quotes: none on this catalogued free surface
- Credential: `FOOTBALL_DATA_ORG_TOKEN`
- Cannot alone produce STRICT odds.

## Blocker

the-odds-api — SOURCE_UNAVAILABLE

Needs: THE_ODDS_API_KEY (live /odds ISO last_update + commence_time). Optional FOOTBALL_DATA_ORG_TOKEN for kickoff/settlement only.

Why not bypassable: Prospective STRICT requires a real observation clock. football-data.org has utcDate kickoff but no bookmaker publish timestamp on the catalogued free surface. Historical hunt is closed (TASK 035). No synthetic quotes. No user-credential bypass.

