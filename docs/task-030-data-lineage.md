# TASK 030 — Data lineage

No new independent market. No ClubElo in STRICT. No silent replace of TASK 028.

| Artifact | SHA-256 / id | Role | Temporal |
|----------|--------------|------|----------|
| TASK 028 STRICT CSV | 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b | 1X2 T-1h LEVEL B MATCH_EXACT | PHP hours_before=1 DERIVED |
| Frozen SHA required | 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b | integrity | immutable |
| T-24h overlay DATASET_030 | c33642c097183d3bff3757fb09e501c22182826d5d652de12da7bfcf631ef21d | movement vs T-1h, same dump | PHP hours_before=24, no interpolation, never bin 0 |
| ClubElo | not used | DATE_ONLY B_RESEARCH | excluded from capital |
| Feature clocks | kickoff < asOf | lagged Elo/form/H2H/schedule | HARD FAIL if availableAt > asOf |

Partitions: TRAIN 3647 · VAL 2295 · TEST 1756 · HOLDOUT 2801

Residual model: z_k = log(p_market_k) + W_k · x. Weights fit on TRAIN only. ALL families chosen on VALIDATION Brier only.
