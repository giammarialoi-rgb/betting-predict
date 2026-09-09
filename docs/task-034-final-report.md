# TASK 034 — FINAL VERDICT

VERDICT: NO_DEMONSTRATED_INEFFICIENCY
STRICT_EVENTS: 10499
MARKET_SNAPSHOTS: 58146
HYPOTHESES: 10
SIGNIFICANT_SIGNALS: 0
BEST_SIGNAL: MARKET_DEVIG
TEST_RESULT: selected_on_val=power
HOLDOUT: EMPTY
COST_ROBUST: N/A
CLV: NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF
CAPITAL_QUALIFIED: false
WINNER: null
AUTO_PROMOTION: false
REAL_MONEY: false

MARKET_EFFICIENCY: MARKET_EFFICIENCY_SUPPORTED
EXECUTION_COST: UNKNOWN
REPRODUCIBILITY: PASS
FINGERPRINT: `0f04323ba8374bf2e0e30ad6a55aff67743b6746a2c172a00d85a7fa52335543`
DATASET_SHA256: `6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b`
EXPERIMENT_SHA256: `0a1ba9a4433162a4caf60791055308786dcd123519c61467e067f0658f836359`
HYPOTHESIS_REGISTRY_HASH: `164c42db6d54b0a1b6191947b6d53807418aa35e59436d4649a7c7e81b0dbd00`


## Signals vs MARKET_DEVIG (TEST)

| Signal | N | Test Brier | Market Brier | Δ | CI95 | Holm | Holdout | Cost Robust | Verdict |
|---|---:|---:|---:|---:|---|---:|---|---|---|
| market | 1756 | 0.198778 | 0.198778 | baseline | — | — | EMPTY | N/A | BASELINE |
| shin | 1756 | 0.198946 | 0.198778 | 0.000169 | [-0.000311, 0.000678] | 1 | EMPTY | N/A | NON_INFERIOR |
| power | 1756 | 0.198879 | 0.198778 | 0.000102 | [-0.000260, 0.000483] | 1 | EMPTY | N/A | NON_INFERIOR |
| additive | 1756 | 0.198833 | 0.198778 | 0.000056 | [-0.000253, 0.000381] | 1 | EMPTY | N/A | NON_INFERIOR |
| best_price | 1756 | 0.198765 | 0.198778 | -0.000013 | [-0.000310, 0.000312] | 1 | EMPTY | N/A | NON_INFERIOR |
| median_consensus | 1756 | 0.199019 | 0.198778 | 0.000241 | [-0.000118, 0.000575] | 1 | EMPTY | N/A | NON_INFERIOR |
| follow_steam | 1756 | 0.199045 | 0.198778 | 0.000268 | [-0.000150, 0.000660] | 1 | EMPTY | N/A | NON_INFERIOR |

## Inefficiency hypotheses

| Hypothesis | N | Definition | Test Δ | CI95 | Holm p | Holdout | Robust | Verdict |
|---|---:|---|---:|---|---:|---|---|---|
| H001 | 1756 | Shin de-vig Brier is lower than proportional MARKET_DEVIG | 0.000169 | [-0.000311, 0.000678] | 1 | EMPTY | N/A | NON_INFERIOR |
| H002 | 1756 | Power de-vig Brier is lower than proportional MARKET_DEVIG | 0.000102 | [-0.000260, 0.000483] | 1 | EMPTY | N/A | NON_INFERIOR |
| H003 | 1756 | Additive-margin de-vig Brier is lower than proportional MARKET_DEVIG | 0.000056 | [-0.000253, 0.000381] | 1 | EMPTY | N/A | NON_INFERIOR |
| H004 | 1756 | Best-price (max odds per selection, then proportional de-vig) beats primary-book MARKET_DEVIG | -0.000013 | [-0.000310, 0.000312] | 1 | EMPTY | N/A | NON_INFERIOR |
| H005 | 1756 | Median cross-book odds then proportional de-vig beats primary-book MARKET_DEVIG | 0.000241 | [-0.000118, 0.000575] | 1 | EMPTY | N/A | NON_INFERIOR |
| H006 | 1756 | Follow steam: mix T-1h toward T-24→T-1 Δp with frozen mix=0.5 when T-24 exists, else market | 0.000268 | [-0.000150, 0.000660] | 1 | EMPTY | N/A | NON_INFERIOR |
| H007 | 1756 | Favorite-longshot: mean residual (observed-implied) in p<0.10 differs from p>=0.90 (diagnostic) | — | — | — | EMPTY | N/A | DIAGNOSTIC |
| H008 | 1756 | Overround Q4 vs Q1: market Brier differs (conditional efficiency diagnostic) | — | — | — | EMPTY | N/A | DIAGNOSTIC |
| H009 | 1756 | Dispersion Q4 vs Q1: market Brier differs when n_books>=2 | — | — | — | EMPTY | N/A | DIAGNOSTIC |
| H010 | 1756 | CLV T-24→T-1h is computed only after LOCK; CLOSE is not a decision feature | — | — | — | EMPTY | N/A | DIAGNOSTIC |

## Coverage (no interpolation)

- T-72h: php_possible=false observed=0 coverage=0.0000
- T-48h: php_possible=true observed=0 coverage=0.0000
- T-24h: php_possible=true observed=8883 coverage=0.8461
- T-12h: php_possible=true observed=0 coverage=0.0000
- T-6h: php_possible=true observed=0 coverage=0.0000
- T-3h: php_possible=true observed=0 coverage=0.0000
- T-1h: php_possible=true observed=10499 coverage=1.0000
- T-30m: php_possible=false observed=0 coverage=0.0000
- T-15m: php_possible=false observed=0 coverage=0.0000
- T-5m: php_possible=false observed=0 coverage=0.0000
- T-1m: php_possible=false observed=0 coverage=0.0000

T-72h and sub-hour windows are 0 on this dump. T-48/12/6/3 exist in PHP bins but were not extracted into TASK_031_BASE; they stay coverage 0 here (no new rows).
Odds-ratio de-vig is NOT_IMPLEMENTED in the consensus engine and was not used as a challenger.

## Final scientific conclusion

MARKET_EFFICIENCY_SUPPORTED. No exploitable price inefficiency survived TEST + Holm + HOLDOUT-empty + cost unknown. The predictive lab remains CLOSED. No TASK 035.

WINNER = null · AUTO_PROMOTION = false · REAL_MONEY = false
