# TASK 031 — Data lineage

DATASET_031_BASE is the frozen TASK 028 STRICT file. New rows may only be appended. The base file is not rewritten.

| Artifact | SHA-256 / id | Role | Temporal | STRICT |
|----------|--------------|------|----------|--------|
| DATASET_031_BASE | 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b | frozen 10.499 T-1h 1X2 | LEVEL_B EXACT_RELATIVE PHP hours_before=1 | 10499 |
| Frozen SHA required | 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b | integrity | immutable | yes |
| DATASET_031_ADD | none | no LEVEL_A/B public append | — | 0 |
| union fingerprint | 65a5f7340dcf5499c45f67d80a5ee7dcd5b452aea9971ab65975936cffca6da9 | base + added ids | — | 10499 |
| TASK 030 fingerprint | ac2ccb13090f86c0007fa4a00cf5ed6f7033097c106980568948fad09ef603f0 | frozen residual MARKET+X | STRICT_AS_OF T-1h | replay |

Period STRICT: 2015-09-01T00:10:00.000Z → 2016-11-19T12:30:00.000Z
HOLD OUT calendar 2020+: 0 events
Corpus partitions (unchanged from TASK 030): TRAIN 3647 · VAL 2295 · TEST 1756 · HOLDOUT 2801

Matching: MATCH_EXACT only (unique calendar date + home slug + away slug). MATCH_AMBIGUOUS / MATCH_PROBABLE / MATCH_FAILED never enter STRICT.

DecisionContext(asOf=kickoff−1h) sees only quote_timestamp ≤ asOf. FT/HT/outcome are settlement-only after LOCK/REVEAL.
