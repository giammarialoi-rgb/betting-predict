# TASK 028 — Statistics

Holm family: TEST_brier_model_minus_market_onesided_model_better
n_tests=7
- market_devig: raw_p=1 adjusted_p=1 rejected=false
- frequency: raw_p=1 adjusted_p=1 rejected=false
- elo: raw_p=1 adjusted_p=1 rejected=false
- form: raw_p=1 adjusted_p=1 rejected=false
- poisson: raw_p=1 adjusted_p=1 rejected=false
- logistic: raw_p=1 adjusted_p=1 rejected=false
- ensemble: raw_p=1 adjusted_p=1 rejected=false

TEST ROI CI: {"mean":-0.5885572499049867,"low":-1.3562077219424473,"high":0.1725389582584519} perm_p=0.1359
HOLDOUT ROI CI: {"mean":-0.32005315823217734,"low":-0.6638084517671079,"high":-0.01736121806112175} perm_p=0.2258

## Stability (frozen Elo, TEST)
- year 2016 n=1756 Brier model=0.2197 market=0.1988

### Leagues (largest n)
- Europe: Europa League n=92 Brier model=0.2202 market=0.2004
- Norway: OBOS-ligaen n=79 Brier model=0.2122 market=0.1842
- Brazil: S�rie B n=51 Brier model=0.2213 market=0.2118
- Iceland: Inkasso-deildin n=46 Brier model=0.2196 market=0.2010
- England: Championship n=45 Brier model=0.2275 market=0.2061
- England: League Two n=45 Brier model=0.2318 market=0.2269
- Finland: Veikkausliiga n=44 Brier model=0.2181 market=0.2028
- Europe: Euro n=44 Brier model=0.2160 market=0.2092
- Denmark: Superliga n=42 Brier model=0.2201 market=0.1985
- England: EFL Cup n=41 Brier model=0.1891 market=0.1629
- England: League One n=38 Brier model=0.2430 market=0.2142
- Finland: Kakkonen Group A n=37 Brier model=0.2086 market=0.2023

### Leagues (worst model Brier, n≥20)
- England: League One n=38 Brier model=0.2430 market=0.2142
- France: Ligue 2 n=31 Brier model=0.2381 market=0.2292
- Peru: Primera Division n=35 Brier model=0.2356 market=0.2289
- Ghana: Premier League n=32 Brier model=0.2328 market=0.1825
- England: League Two n=45 Brier model=0.2318 market=0.2269
- Europe: Champions League n=34 Brier model=0.2284 market=0.1858
- Brazil: S�rie C n=31 Brier model=0.2282 market=0.2157
- Mexico: Primera Division n=28 Brier model=0.2280 market=0.2121

## Market efficiency (TEST, not an edge claim)
- favorite n=1756 mean_p=0.5049 freq=0.5051
- underdog n=1756 mean_p=0.2214 freq=0.2141
- fav_odds_1.01-1.50 n=275 mean_p=0.7104 freq=0.7164
- fav_odds_1.50-2.00 n=586 mean_p=0.5478 freq=0.5478
- fav_odds_2.00-3.00 n=895 mean_p=0.4137 freq=0.4123
- fav_odds_3.00+ n=0 mean_p=— freq=—
- overround_<1.05 n=1205 mean_p=0.4962 freq=0.4938
- overround_1.05-1.08 n=128 mean_p=0.5234 freq=0.5313
- overround_>=1.08 n=423 mean_p=0.5242 freq=0.5296

## VALIDATION diagnostic thresholds (not used for TEST selection)
- threshold=0 bets=814 ROI=-0.2706 used_for_primary=false
- threshold=0.01 bets=813 ROI=-0.2707 used_for_primary=false
- threshold=0.02 bets=782 ROI=-0.2723 used_for_primary=false
- threshold=0.03 bets=743 ROI=-0.2738 used_for_primary=false
- threshold=0.05 bets=645 ROI=-0.3368 used_for_primary=false
- threshold=0.1 bets=444 ROI=-0.3875 used_for_primary=false
