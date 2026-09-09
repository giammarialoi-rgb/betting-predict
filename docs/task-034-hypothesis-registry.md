# TASK 034 — Hypothesis registry

All hypotheses were frozen in `experiments/exp_034_market_inefficiency.json` / `hypotheses.ts` before TEST.

Registry hash: `164c42db6d54b0a1b6191947b6d53807418aa35e59436d4649a7c7e81b0dbd00`

| ID | Inferential | Definition | Status |
|---|---|---|---|
| H001 | true | Shin de-vig Brier is lower than proportional MARKET_DEVIG | NON_INFERIOR |
| H002 | true | Power de-vig Brier is lower than proportional MARKET_DEVIG | NON_INFERIOR |
| H003 | true | Additive-margin de-vig Brier is lower than proportional MARKET_DEVIG | NON_INFERIOR |
| H004 | true | Best-price (max odds per selection, then proportional de-vig) beats primary-book MARKET_DEVIG | NON_INFERIOR |
| H005 | true | Median cross-book odds then proportional de-vig beats primary-book MARKET_DEVIG | NON_INFERIOR |
| H006 | true | Follow steam: mix T-1h toward T-24→T-1 Δp with frozen mix=0.5 when T-24 exists, else market | NON_INFERIOR |
| H007 | false | Favorite-longshot: mean residual (observed-implied) in p<0.10 differs from p>=0.90 (diagnostic) | DIAGNOSTIC |
| H008 | false | Overround Q4 vs Q1: market Brier differs (conditional efficiency diagnostic) | DIAGNOSTIC |
| H009 | false | Dispersion Q4 vs Q1: market Brier differs when n_books>=2 | DIAGNOSTIC |
| H010 | false | CLV T-24→T-1h is computed only after LOCK; CLOSE is not a decision feature | DIAGNOSTIC |
