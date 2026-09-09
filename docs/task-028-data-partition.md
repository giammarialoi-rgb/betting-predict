# TASK 028 — Data partition

Temporal cuts frozen in `experiments/exp_028_scientific_validation_v1.json` before metrics.
Rationale: BeatTheBookie odds_series through Feb 2016, then odds_series_b. Not sliced on ROI.

| Partition | Start | End | Events |
|-----------|-------|-----|-------:|
| TRAIN | 2015-09-01 | 2016-02-29 | 3647 |
| VALIDATION | 2016-03-01 | 2016-05-31 | 2295 |
| TEST | 2016-06-01 | 2016-08-31 | 1756 |
| HOLDOUT | 2016-09-01 | 2016-12-31 | 2801 |

Project calendar HOLDOUT years 2020–2024: **0** STRICT events on this corpus.
HOLDOUT (corpus) is sacred for TASK 028 model/threshold/staking selection.
