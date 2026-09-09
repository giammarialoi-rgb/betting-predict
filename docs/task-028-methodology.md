# TASK 028 — Methodology

- experiment_id=exp_028_scientific_validation_v1
- dataset sha256=6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b
- git=unknown
- asOf=STRICT_AS_OF T-1h LEVEL B
- frozen_model=elo threshold=0.03 (TASK 027, not reselected)
- logistic fit=TRAIN only then freeze
- bootstrap=block calendar_week n=1000 seed=28
- permutation n=1000
- multiple testing=holm_bonferroni on TEST Brier(model)−Brier(market) one-sided
- de-vig=proportional (normalizeMarketProbabilities)
- CLV=not computed (single snapshot)
- random split=forbidden
- exclusions=[] (none after seeing results)
- diagnostic thresholds evaluated on VALIDATION only; frozen primary threshold=0.03
- risk challengers on TEST are not used for selection (Masaniello = challenger)
- feature ablation labels require TRAIN+TEST improvement; not used to change the frozen model
- rho=UNKNOWN → conservative exposure caps (day / match / cluster hour)
- TASK 027 annual table had 8 bets because openClusterExposure never reset (bug). TASK 028 resets the cluster cap when the kickoff hour changes.
