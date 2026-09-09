# TASK 036 — PROSPECTIVE STRICT LAB

TASK 036 VERDICT:
COLLECTION_STATUS: BLOCKED
SOURCE: the-odds-api+football-data-org
SOURCE_STATUS: SOURCE_UNAVAILABLE
COLLECTION_START: 2026-09-07T00:00:00.000Z
EVENTS_DISCOVERED: 0
QUOTE_OBSERVATIONS: 0
STRICT_EVENTS: 0
STRICT_QUOTES: 0
EXACT_KICKOFFS: 0
T72_COVERAGE: 0
T24_COVERAGE: 0
T1H_COVERAGE: 0
T5M_COVERAGE: 0
LOCKED_DECISIONS: 0
SETTLED_EVENTS: 0
MODEL_READY: false
TEST_EVENTS: 0
HOLDOUT_EVENTS: 0
EDGE: false
BETS: 0
BANKROLL: —
WINNER: null
AUTO_PROMOTION: false
REAL_MONEY: false
REPRODUCIBILITY: PASS
LEAKAGE: PASS
FINAL_VERDICT: PROSPECTIVE_COLLECTION_BLOCKED

## Blocker

- source: the-odds-api
- error: SOURCE_UNAVAILABLE
- needs: THE_ODDS_API_KEY (live /odds ISO last_update + commence_time). Optional FOOTBALL_DATA_ORG_TOKEN for kickoff/settlement only.
- why not bypassable: Prospective STRICT requires a real observation clock. football-data.org has utcDate kickoff but no bookmaker publish timestamp on the catalogued free surface. Historical hunt is closed (TASK 035). No synthetic quotes. No user-credential bypass.


## Historical vs prospective

- HISTORICAL: TASK_031_BASE · STRICT 10499 · HOLDOUT 2020+ 0
- PROSPECTIVE: STRICT 0 quotes 0 · locked 0

TASK 035 closed the historical hunt. TASK 036 does not reopen it. TASK 037 historical search is forbidden.

Cold start is OBSERVATION_ONLY until 100 STRICT events. MARKET_DEVIG remains the benchmark. No model retune on the first events. BETS=0. BANKROLL=—. REAL_MONEY=false.

- fingerprint: `d447846e58290f0c01d4391d9b4af241360c2e27ee393e83554836465b57cc90`
- experiment: `520960032f0de996b9ac850ea807d4b91ebe72ecad87ec07058e0c8df97d6ef6`
- dataset: `5ebe75d644ab1a0d7f5ad09812ed61b295e657a3916999db432c16f6d3d66f5a`
