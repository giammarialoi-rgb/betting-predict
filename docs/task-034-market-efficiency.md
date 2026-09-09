# TASK 034 — Market efficiency

Verdict: NO_DEMONSTRATED_INEFFICIENCY
Label: MARKET_EFFICIENCY_SUPPORTED

Hosmer–Lemeshow (home, TEST): n=1756 chi2=16.384107 df=8
Brier decomp home (TEST): brier=0.223448 reliability=0.001545 resolution=0.025189 uncertainty=0.248127

Permutation tests are one-sided on market_brier − challenger_brier (H1: challenger improves Brier).
Holm correction is applied to the six pre-registered inferential hypotheses.
HOLDOUT 2020+ = EMPTY — EDGE_CONFIRMED is impossible on this corpus.

### Overround quartiles (cuts from TRAIN, scores on TEST)

| Q | N | Brier |
|---|---:|---:|
| Q1 | 163 | 0.210033 |
| Q2 | 264 | 0.196714 |
| Q3 | 411 | 0.201278 |
| Q4 | 918 | 0.196253 |

### Dispersion quartiles (TRAIN cuts, TEST, n_books≥2)

| Q | N | Brier |
|---|---:|---:|
| Q1 | 615 | 0.176958 |
| Q2 | 398 | 0.209299 |
| Q3 | 374 | 0.219025 |
| Q4 | 348 | 0.205174 |

### Conditional efficiency (ex-ante groups, TEST diagnostic, not Holm)

| Group | Level | N | Brier |
|---|---|---:|---:|
| weekday | Fri | 143 | 0.207984 |
| weekday | Mon | 71 | 0.216500 |
| weekday | Sat | 529 | 0.197579 |
| weekday | Sun | 560 | 0.199172 |
| weekday | Thu | 171 | 0.195131 |
| weekday | Tue | 130 | 0.193299 |
| weekday | Wed | 152 | 0.193343 |
| season | 2016 | 1756 | 0.198778 |
| favorite_side | AWAY | 468 | 0.208827 |
| favorite_side | DRAW | 4 | 0.215284 |
| favorite_side | HOME | 1284 | 0.195063 |
| movement_direction | drift | 418 | 0.198902 |
| movement_direction | no_second_snapshot | 337 | 0.192660 |
| movement_direction | reverse_steam | 290 | 0.210320 |
| movement_direction | stability | 287 | 0.192963 |
| movement_direction | steam | 424 | 0.199558 |
| league | Brazil: S�rie B | 51 | 0.211762 |
| league | Brazil: S�rie C | 31 | 0.215670 |
| league | Cameroon: Elite One | 25 | 0.196897 |
| league | Denmark: Superliga | 42 | 0.198532 |
| league | England: Championship | 45 | 0.206055 |
| league | England: EFL Cup | 41 | 0.162912 |
| league | England: League One | 38 | 0.214245 |
| league | England: League Two | 45 | 0.226910 |
| league | England: Premier League | 20 | 0.201619 |
| league | Europe: Champions League | 34 | 0.185765 |
| league | Europe: Euro | 44 | 0.209191 |
| league | Europe: Europa League | 92 | 0.200357 |
| league | Finland: Kakkonen Group A | 37 | 0.202269 |
| league | Finland: Veikkausliiga | 44 | 0.202757 |
| league | France: Ligue 1 | 30 | 0.198722 |
| league | France: Ligue 2 | 31 | 0.229172 |
| league | France: National | 25 | 0.232783 |
| league | Ghana: Premier League | 32 | 0.182548 |
| league | Iceland: Division 2 | 20 | 0.201019 |
| league | Iceland: Inkasso-deildin | 46 | 0.200961 |
| league | Italy: Coppa Italia | 30 | 0.134816 |
| league | Mexico: Primera Division | 28 | 0.212118 |
| league | Myanmar: National League | 33 | 0.174402 |
| league | Netherlands: Eredivisie | 21 | 0.199611 |
| league | Norway: OBOS-ligaen | 79 | 0.184210 |
| league | Peru: Primera Division | 35 | 0.228858 |
| league | Portugal: Segunda Liga | 36 | 0.200931 |
| league | Russia: Division 1 | 30 | 0.207744 |
| league | Sweden: Allsvenskan | 24 | 0.206942 |
| time_to_kickoff | T-1h | 1756 | 0.198778 |

The T-1h 1X2 book, after proportional de-vig, is not beaten by Shin, Power, additive, best-price, median consensus, or frozen steam-follow.

Friction scenarios 0 / 0.5 / 1 / 2 / 3% were not executed: capital gate closed.
